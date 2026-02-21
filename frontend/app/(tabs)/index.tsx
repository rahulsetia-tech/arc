import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/utils/api';
import { getUser } from '../../src/utils/auth';
import { userColor, myTerritoryColor, geoJsonToMapCoords } from '../../src/utils/geo';

// Conditional map import
let MapView: any = null;
let Marker: any = null;
let Polygon: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  Polygon = Maps.Polygon;
  Polyline = Maps.Polyline;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

import { DARK_MAP_STYLE } from '../../src/constants/mapStyles';

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
  const [currentRegion, setCurrentRegion] = useState<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
  }, []);

  const loadTerritories = useCallback(async (region?: any) => {
    try {
      setLoading(true);
      const r = region || currentRegion;
      if (!r) return;
      const { latitude, longitude, latitudeDelta, longitudeDelta } = r;
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
  }, [currentRegion]);

  function onRegionChangeComplete(region: any) {
    setCurrentRegion(region);
    loadTerritories(region);
  }

  function handleStartRun() {
    router.push('/run/active');
  }

  if (Platform.OS === 'web') {
    return <WebMapFallback territories={territories} onStartRun={handleStartRun} insets={insets} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        mapType="standard"
        initialRegion={{
          latitude: 51.5074,
          longitude: -0.1278,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {territories.map((territory) => {
          if (!territory.polygon?.coordinates?.[0]) return null;
          const isMyTerritory = territory.userId === currentUser?.id;
          const colors = isMyTerritory
            ? myTerritoryColor()
            : userColor(territory.userId);

          const outerRing = territory.polygon.coordinates[0];
          const coords = geoJsonToMapCoords(outerRing);

          return (
            <Polygon
              key={territory.id}
              coordinates={coords}
              fillColor={colors.fill}
              strokeColor={colors.stroke}
              strokeWidth={isMyTerritory ? 2.5 : 1.5}
              tappable
              onPress={() => setSelectedTerritory(territory)}
            />
          );
        })}
      </MapView>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appName}>SUPERACRES</Text>
        {loading && <ActivityIndicator color="#00FF88" size="small" />}
      </View>

      {/* Territory Info Callout */}
      {selectedTerritory && (
        <View style={styles.callout}>
          <View style={styles.calloutContent}>
            <View style={[styles.colorDot, {
              backgroundColor: userColor(selectedTerritory.userId).hex
            }]} />
            <View style={styles.calloutText}>
              <Text style={styles.calloutOwner}>@{selectedTerritory.username}</Text>
              <Text style={styles.calloutArea}>
                {selectedTerritory.areaKm2 < 0.01
                  ? `${Math.round(selectedTerritory.areaKm2 * 1000000)} m²`
                  : `${selectedTerritory.areaKm2.toFixed(4)} km²`
                }
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setSelectedTerritory(null)} style={styles.calloutClose}>
            <Text style={styles.calloutCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* START RUN Button */}
      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 80 }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStartRun}
            activeOpacity={0.8}
            data-testid="start-run-button"
          >
            <Text style={styles.startButtonIcon}>▶</Text>
            <Text style={styles.startButtonText}>START RUN</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

// Fallback for web
function WebMapFallback({ territories, onStartRun, insets }: any) {
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appName}>SUPERACRES</Text>
      </View>

      <View style={styles.webFallback}>
        <Text style={styles.webFallbackIcon}>🗺️</Text>
        <Text style={styles.webFallbackTitle}>MAP</Text>
        <Text style={styles.webFallbackText}>
          Open SUPERACRES in Expo Go on your mobile device to see the live territory map and start running!
        </Text>
        <View style={styles.webStats}>
          <Text style={styles.webStatsText}>{territories.length} territories loaded</Text>
        </View>
      </View>

      <View style={[styles.fabContainer, { paddingBottom: insets.bottom + 80 }]}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={onStartRun}
          activeOpacity={0.8}
          data-testid="start-run-button"
        >
          <Text style={styles.startButtonIcon}>▶</Text>
          <Text style={styles.startButtonText}>START RUN</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
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
  calloutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  calloutText: {
    flex: 1,
  },
  calloutOwner: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  calloutArea: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  calloutClose: {
    padding: 4,
  },
  calloutCloseText: {
    color: '#888',
    fontSize: 16,
  },
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
  startButtonIcon: {
    fontSize: 16,
    color: '#0D0D0D',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: 2,
  },
  // Web fallback styles
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 80,
  },
  webFallbackIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  webFallbackTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 4,
    marginBottom: 16,
  },
  webFallbackText: {
    color: '#888',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  webStats: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  webStatsText: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: '600',
  },
});
