import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  AppState,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../../src/utils/api';
import { formatDuration, formatPace, haversineDistance } from '../../src/utils/geo';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditional map import
let MapView: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

import { DARK_MAP_STYLE } from '../../src/constants/mapStyles';

interface Coord {
  latitude: number;
  longitude: number;
}

export default function ActiveRunScreen() {
  const insets = useSafeAreaInsets();
  const [runId, setRunId] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coord[]>([]);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [pace, setPace] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coord | null>(null);
  const [status, setStatus] = useState<'requesting' | 'active' | 'stopping'>('requesting');
  const [mapRegion, setMapRegion] = useState<any>(null);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coordsRef = useRef<Coord[]>([]);
  const startTimeRef = useRef<Date | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    initRun();
    return () => {
      cleanup();
    };
  }, []);

  // Timer
  useEffect(() => {
    if (status === 'active') {
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const secs = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setElapsed(secs);
          // Calculate pace
          const dist = coordsRef.current.length > 1
            ? coordsRef.current.reduce((acc, c, i) => {
                if (i === 0) return acc;
                const prev = coordsRef.current[i - 1];
                return acc + haversineDistance([prev.longitude, prev.latitude], [c.longitude, c.latitude]);
              }, 0)
            : 0;
          if (dist > 0) {
            const paceVal = (secs / 60) / dist;
            setPace(paceVal);
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
      // Request location permission
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'SUPERACRES needs your location to track your run and capture territory.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        return;
      }

      // Start the run on backend
      const runData = await api.startRun() as any;
      setRunId(runData.runId);
      runIdRef.current = runData.runId;

      // Get initial location
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialCoord = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setCurrentLocation(initialCoord);
      setCoords([initialCoord]);
      coordsRef.current = [initialCoord];
      setMapRegion({
        latitude: initialCoord.latitude,
        longitude: initialCoord.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });

      const now = new Date();
      setStartTime(now);
      startTimeRef.current = now;
      setStatus('active');

      // Start watching location
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const newCoord = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setCurrentLocation(newCoord);
          setCoords((prev) => [...prev, newCoord]);
          coordsRef.current = [...coordsRef.current, newCoord];

          // Update distance
          if (coordsRef.current.length > 1) {
            const prev = coordsRef.current[coordsRef.current.length - 2];
            const dist = haversineDistance(
              [prev.longitude, prev.latitude],
              [newCoord.longitude, newCoord.latitude]
            );
            setDistanceKm((d) => d + dist);
          }

          setMapRegion({
            latitude: newCoord.latitude,
            longitude: newCoord.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not start run');
      router.back();
    }
  }

  function cleanup() {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function handleStopRun() {
    if (status !== 'active') return;
    if (coordsRef.current.length < 2) {
      Alert.alert(
        'Too Short',
        'Run a little more before stopping! Need at least 2 GPS points.',
        [{ text: 'Keep Running', style: 'cancel' }]
      );
      return;
    }

    Alert.alert(
      'Stop Run?',
      'Are you sure you want to stop your run?',
      [
        { text: 'Keep Running', style: 'cancel' },
        {
          text: 'Stop & Save',
          style: 'destructive',
          onPress: submitRun,
        },
      ]
    );
  }

  async function submitRun() {
    if (!runIdRef.current) return;
    setStatus('stopping');
    cleanup();

    try {
      // Convert coords to GeoJSON format [[lng, lat]]
      const geoCoords = coordsRef.current.map((c) => [c.longitude, c.latitude]);

      const result = await api.endRun(runIdRef.current, geoCoords) as any;

      // Save result to AsyncStorage for summary screen
      await AsyncStorage.setItem('last_run_result', JSON.stringify(result));

      router.replace('/run/summary');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not save run');
      setStatus('active');
    }
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

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={[styles.webHeader, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.webTitle}>ACTIVE RUN</Text>
        </View>
        <View style={styles.webContent}>
          <Text style={styles.webIcon}>🏃</Text>
          <Text style={styles.webText}>GPS tracking active on mobile</Text>
          <Text style={styles.webSubtext}>{coords.length} GPS points collected</Text>
          <View style={styles.webStatsRow}>
            <WebStat label="TIME" value={formatDuration(elapsed)} />
            <WebStat label="DISTANCE" value={`${distanceKm.toFixed(2)} km`} />
            <WebStat label="PACE" value={formatPace(pace)} />
          </View>
        </View>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStopRun}
            data-testid="stop-run-button"
          >
            <Text style={styles.stopButtonText}>STOP RUN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        region={mapRegion}
        showsUserLocation
        followsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {coords.length > 1 && (
          <Polyline
            coordinates={coords}
            strokeColor="#00F0FF"
            strokeWidth={4}
            lineDashPattern={undefined}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topBarTitle}>RUNNING</Text>
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>REC</Text>
        </View>
      </View>

      {/* Stats bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.statsRow}>
          <StatItem label="TIME" value={formatDuration(elapsed)} />
          <View style={styles.statDivider} />
          <StatItem label="DISTANCE" value={`${distanceKm.toFixed(2)} km`} />
          <View style={styles.statDivider} />
          <StatItem label="PACE" value={`${formatPace(pace)}/km`} />
        </View>

        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopRun}
          activeOpacity={0.8}
          data-testid="stop-run-button"
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

function WebStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.webStat}>
      <Text style={styles.webStatValue}>{value}</Text>
      <Text style={styles.webStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statusSubtext: {
    color: '#888',
    fontSize: 14,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(13, 13, 13, 0.8)',
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
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  recordingText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 13, 13, 0.95)',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    padding: 20,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#2A2A2A',
  },
  stopButton: {
    backgroundColor: '#FF3366',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  gpsCount: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
  },
  // Web styles
  webHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  webTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
  },
  webContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  webIcon: {
    fontSize: 64,
  },
  webText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  webSubtext: {
    color: '#888',
    fontSize: 14,
  },
  webStatsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  webStat: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  webStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  webStatLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 4,
  },
});
