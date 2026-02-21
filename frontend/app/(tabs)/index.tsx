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
import { router } from 'expo-router';
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

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    // Load initial territories (London area)
    loadTerritories({
      latitude: 51.5074,
      longitude: -0.1278,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  }, []);

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

  return (
    <View style={styles.container}>
      <TerritoryMap
        territories={territories}
        currentUserId={currentUser?.id}
        onRegionChange={loadTerritories}
        onTerritoryPress={setSelectedTerritory}
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
