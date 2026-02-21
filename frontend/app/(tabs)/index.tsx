import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../../src/utils/api';
import { getUser } from '../../src/utils/auth';
import { userColor } from '../../src/utils/geo';
import { TerritoryMap } from '../../src/components/TerritoryMap';

interface Territory {
  id: string;
  userId: string;
  username: string;
  polygon: { type: string; coordinates: number[][][] };
  areaKm2: number;
  color: string;
  capturedAt: string;
}

const LONDON_FALLBACK = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  // FIX 1: user location state
  const [userRegion, setUserRegion] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // FIX 1: ref to MapView for animateToRegion
  const mapRef = useRef<any>(null);

  // Pulse animation for START RUN button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    getUser().then(setCurrentUser);
    // FIX 1: get user location on mount
    initLocation();
  }, []);

  // FIX 5: Refresh territories when map tab gains focus (after returning from a run)
  useFocusEffect(
    useCallback(() => {
      const region = userRegion || LONDON_FALLBACK;
      loadTerritories(region);
    }, [userRegion])
  );

  async function initLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        setUserRegion(region);
        loadTerritories(region);
      } else {
        // Permission denied - fall back to London
        loadTerritories(LONDON_FALLBACK);
      }
    } catch {
      // Any error - fall back to London
      loadTerritories(LONDON_FALLBACK);
    }
  }

  const loadTerritories = useCallback(async (region: any) => {
    try {
      setLoading(true);
      const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
      const minLat = latitude - latitudeDelta;
      const maxLat = latitude + latitudeDelta;
      const minLng = longitude - longitudeDelta;
      const maxLng = longitude + longitudeDelta;
      const data = await api.getTerritories(minLng, minLat, maxLng, maxLat) as Territory[];
      setTerritories(data);
    } catch (err) {
      console.log('Territory load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // FIX 1: "My Location" button handler
  async function goToMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setUserRegion(region);
      // Animate map to user location if mapRef is available
      if (mapRef.current?.animateToRegion) {
        mapRef.current.animateToRegion(region, 600);
      }
      loadTerritories(region);
    } catch (err) {
      console.log('Location error:', err);
    }
  }

  return (
    <View style={styles.container}>
      <TerritoryMap
        ref={mapRef}
        territories={territories}
        currentUserId={currentUser?.id}
        onRegionChange={loadTerritories}
        onTerritoryPress={setSelectedTerritory}
        initialRegion={userRegion || LONDON_FALLBACK}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appName}>SUPERACRES</Text>
        {loading && <ActivityIndicator color="#00FF88" size="small" />}
      </View>

      {/* Territory Info Callout */}
      {selectedTerritory && (
        <View style={styles.callout}>
          <View style={styles.calloutContent}>
            <View
              style={[
                styles.colorDot,
                { backgroundColor: userColor(selectedTerritory.userId).hex },
              ]}
            />
            <View style={styles.calloutText}>
              <Text style={styles.calloutOwner}>@{selectedTerritory.username}</Text>
              <Text style={styles.calloutArea}>
                {selectedTerritory.areaKm2 < 0.01
                  ? `${Math.round(selectedTerritory.areaKm2 * 1000000)} m²`
                  : `${selectedTerritory.areaKm2.toFixed(4)} km²`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setSelectedTerritory(null)}
            style={styles.calloutClose}
          >
            <Text style={styles.calloutCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FIX 1: My Location button (bottom-right, above START RUN) */}
      <View style={[styles.myLocationContainer, { bottom: insets.bottom + 148 }]}>
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={goToMyLocation}
          testID="my-location-button"
        >
          <Text style={styles.myLocationIcon}>📍</Text>
        </TouchableOpacity>
      </View>

      {/* START RUN Button */}
      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 80 }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push('/run/active')}
            activeOpacity={0.8}
            testID="start-run-button"
          >
            <Text style={styles.startButtonIcon}>▶</Text>
            <Text style={styles.startButtonText}>START RUN</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B2A' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    zIndex: 10,
  },
  appName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,255,136,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  callout: {
    position: 'absolute',
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  calloutContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  calloutText: { flex: 1 },
  calloutOwner: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  calloutArea: { color: '#888', fontSize: 13, marginTop: 2 },
  calloutClose: { padding: 4 },
  calloutCloseText: { color: '#888', fontSize: 16 },
  // FIX 1: My Location button
  myLocationContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  myLocationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  myLocationIcon: { fontSize: 22 },
  fabContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  startButton: {
    backgroundColor: '#00FF88',
    borderRadius: 50,
    paddingVertical: 18,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  startButtonIcon: { fontSize: 16, color: '#0D0D0D' },
  startButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: 2,
  },
});
