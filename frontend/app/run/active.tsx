import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../src/utils/api';
import { formatDuration, formatPace, haversineDistance } from '../../src/utils/geo';
import { RunningMap } from '../../src/components/RunningMap';

// FIX 2: Background location task (must be at module level, outside component)
let TaskManager: any = null;
const BACKGROUND_LOCATION_TASK = 'superacres-background-location';
const BG_BUFFER_KEY = 'bg_location_buffer';

// Only register background task on native (not web)
if (Platform.OS !== 'web') {
  try {
    TaskManager = require('expo-task-manager');
    TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
      if (error) {
        console.log('BG location task error:', error);
        return;
      }
      if (data) {
        const { locations } = data as any;
        try {
          const existing = await AsyncStorage.getItem(BG_BUFFER_KEY);
          const buffer: any[] = existing ? JSON.parse(existing) : [];
          for (const loc of locations) {
            buffer.push({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              timestamp: loc.timestamp,
            });
          }
          await AsyncStorage.setItem(BG_BUFFER_KEY, JSON.stringify(buffer));
        } catch (e) {
          console.log('BG buffer write error:', e);
        }
      }
    });
  } catch (e) {
    console.log('TaskManager not available:', e);
  }
}

interface Coord {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

export default function ActiveRunScreen() {
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState<Coord[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [pace, setPace] = useState(0);
  const [status, setStatus] = useState<'requesting' | 'active' | 'stopping'>('requesting');
  const [mapRegion, setMapRegion] = useState<any>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef<Coord[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const runIdRef = useRef<string | null>(null);
  const distanceRef = useRef(0);

  // FIX 7: Animated blinking dot for recording indicator
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start blinking animation
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, []);

  useEffect(() => {
    initRun();
    return cleanup;
  }, []);

  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const secs = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setElapsed(secs);
          if (distanceRef.current > 0 && secs > 0) {
            setPace((secs / 60) / distanceRef.current);
          }
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  async function initRun() {
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Location Required',
          'SUPERACRES needs your location to track runs.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      const runData = await api.startRun() as any;
      runIdRef.current = runData.runId;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialCoord: Coord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: loc.timestamp,
      };

      setCoords([initialCoord]);
      coordsRef.current = [initialCoord];
      setMapRegion({
        latitude: initialCoord.latitude,
        longitude: initialCoord.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });

      // Clear any previous bg buffer
      await AsyncStorage.removeItem(BG_BUFFER_KEY);

      startTimeRef.current = new Date();
      setStatus('active');

      // FIX 7: Haptic feedback when run starts
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      // Start foreground location tracking
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const newCoord: Coord = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          };

          if (coordsRef.current.length > 0) {
            const prev = coordsRef.current[coordsRef.current.length - 1];
            const dist = haversineDistance(
              [prev.longitude, prev.latitude],
              [newCoord.longitude, newCoord.latitude]
            );
            distanceRef.current += dist;
            setDistanceKm(distanceRef.current);
          }

          coordsRef.current = [...coordsRef.current, newCoord];
          setCoords([...coordsRef.current]);
          setMapRegion({
            latitude: newCoord.latitude,
            longitude: newCoord.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      );

      // FIX 2: Start background location tracking (native only)
      if (Platform.OS !== 'web' && TaskManager) {
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (bgStatus === 'granted') {
            await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 5000,
              distanceInterval: 10,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'SUPERACRES',
                notificationBody: 'Tracking your run...',
                notificationColor: '#00FF88',
              },
            });
          } else {
            console.log('Background location permission denied — using foreground only');
          }
        } catch (bgErr) {
          // Non-fatal: continue with foreground-only tracking
          console.log('Background location not available:', bgErr);
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start run');
      router.back();
    }
  }

  function cleanup() {
    locationSubscription.current?.remove();
    if (timerRef.current) clearInterval(timerRef.current);
    // FIX 2: Stop background location task
    if (Platform.OS !== 'web' && TaskManager) {
      Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => {});
    }
  }

  async function handleStopRun() {
    if (status !== 'active') return;
    if (coordsRef.current.length < 2) {
      Alert.alert('Too Short', 'Need at least 2 GPS points.', [
        { text: 'Keep Running', style: 'cancel' },
      ]);
      return;
    }
    // FIX 7: Haptic feedback on stop press
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    Alert.alert('Stop Run?', 'Save your run and claim territory?', [
      { text: 'Keep Running', style: 'cancel' },
      { text: 'Stop & Save', style: 'destructive', onPress: submitRun },
    ]);
  }

  async function submitRun() {
    if (!runIdRef.current) return;
    setStatus('stopping');
    cleanup();
    try {
      // FIX 2: Merge background location buffer with foreground coords
      let allCoords = [...coordsRef.current];
      try {
        const bgRaw = await AsyncStorage.getItem(BG_BUFFER_KEY);
        if (bgRaw) {
          const bgCoords: Coord[] = JSON.parse(bgRaw);
          // Merge and deduplicate by proximity/timestamp
          allCoords = mergeCoords(allCoords, bgCoords);
          await AsyncStorage.removeItem(BG_BUFFER_KEY);
        }
      } catch (e) {
        console.log('BG buffer read error:', e);
        // Continue with foreground coords only
      }

      const geoCoords = allCoords.map((c) => [c.longitude, c.latitude]);
      const result = await api.endRun(runIdRef.current, geoCoords) as any;
      await AsyncStorage.setItem('last_run_result', JSON.stringify(result));
      router.replace('/run/summary');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save run');
      setStatus('active');
    }
  }

  // FIX 2: Merge foreground and background coords, sorted by timestamp
  function mergeCoords(foreground: Coord[], background: Coord[]): Coord[] {
    const combined = [...foreground, ...background];
    // Sort by timestamp if available
    combined.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    // Remove near-duplicates (within ~3m)
    const result: Coord[] = [];
    for (const c of combined) {
      if (result.length === 0) {
        result.push(c);
        continue;
      }
      const last = result[result.length - 1];
      const dist = haversineDistance([last.longitude, last.latitude], [c.longitude, c.latitude]);
      if (dist > 0.003) { // > 3m apart
        result.push(c);
      }
    }
    return result.length >= 2 ? result : foreground;
  }

  if (status === 'requesting') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00FF88" />
        <Text style={styles.statusText}>Getting location...</Text>
      </View>
    );
  }

  if (status === 'stopping') {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#00FF88" />
        <Text style={styles.statusText}>Computing territory...</Text>
        <Text style={styles.statusSubtext}>Claiming your ground 📍</Text>
      </View>
    );
  }

  // FIX 7: calorie estimate
  const calories = distanceKm > 0 ? Math.round(distanceKm * 62) : null;

  return (
    <View style={styles.container}>
      <RunningMap coords={coords} region={mapRegion} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topBarTitle}>RUNNING</Text>
        <View style={styles.recordingIndicator}>
          {/* FIX 7: Animated blinking dot */}
          <Animated.View style={[styles.recordingDot, { opacity: blinkAnim }]} />
          <Text style={styles.recordingText}>REC</Text>
        </View>
      </View>

      {/* Stats + Stop button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.statsRow}>
          <StatItem label="TIME" value={formatDuration(elapsed)} />
          <View style={styles.statDivider} />
          <StatItem label="DISTANCE" value={`${distanceKm.toFixed(2)} km`} />
          <View style={styles.statDivider} />
          <StatItem label="PACE" value={`${formatPace(pace)}/km`} />
          {/* FIX 7: Calorie estimate (only when > 0) */}
          {calories !== null && (
            <>
              <View style={styles.statDivider} />
              <StatItem label="KCAL" value={`~${calories}`} />
            </>
          )}
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopRun}
          activeOpacity={0.8}
          testID="stop-run-button"
        >
          <Text style={styles.stopButtonText}>■ STOP RUN</Text>
        </TouchableOpacity>

        <Text style={styles.gpsCount}>{coords.length} GPS points</Text>
      </View>
    </View>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  statusText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  statusSubtext: { color: '#888', fontSize: 14 },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(13,13,13,0.85)',
    zIndex: 10,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 3,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF3366',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  recordingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  recordingText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(13,13,13,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    padding: 20,
    gap: 16,
    zIndex: 10,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  statLabel: { color: '#888', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: '#2A2A2A' },
  stopButton: {
    backgroundColor: '#FF3366',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  stopButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  gpsCount: { color: '#444', fontSize: 11, textAlign: 'center' },
});
