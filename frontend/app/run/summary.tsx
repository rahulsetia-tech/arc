import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDuration, formatPace, geoJsonToMapCoords, myTerritoryColor } from '../../src/utils/geo';

// Conditional map import
let MapView: any = null;
let Polyline: any = null;
let Polygon: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Polyline = Maps.Polyline;
  Polygon = Maps.Polygon;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}

import { DARK_MAP_STYLE } from '../../src/constants/mapStyles';

export default function RunSummaryScreen() {
  const insets = useSafeAreaInsets();
  const [runResult, setRunResult] = useState<any>(null);
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    loadResult();
  }, []);

  useEffect(() => {
    if (runResult) {
      // Celebration animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(celebrateAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [runResult]);

  async function loadResult() {
    try {
      const raw = await AsyncStorage.getItem('last_run_result');
      if (raw) {
        setRunResult(JSON.parse(raw));
      }
    } catch (err) {
      console.log('Summary load error:', err);
    }
  }

  function handleBackToMap() {
    router.replace('/(tabs)');
  }

  if (!runResult) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.noDataText}>No run data found</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToMap}>
          <Text style={styles.backButtonText}>BACK TO MAP</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { run, territoryStolenFrom } = runResult;
  const routeCoords = run?.routeCoordinates?.coordinates
    ? geoJsonToMapCoords(run.routeCoordinates.coordinates)
    : [];

  const territoryCoords = run?.territoryPolygon?.coordinates?.[0]
    ? geoJsonToMapCoords(run.territoryPolygon.coordinates[0])
    : [];

  // Calculate map region from route
  let mapRegion = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  if (routeCoords.length > 0) {
    const lats = routeCoords.map((c: any) => c.latitude);
    const lngs = routeCoords.map((c: any) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    mapRegion = {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(maxLat - minLat, 0.005) * 2,
      longitudeDelta: Math.max(maxLng - minLng, 0.005) * 2,
    };
  }

  const colors = myTerritoryColor();
  const territoryGainedKm2 = run?.territoryGainedKm2 || 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🎉</Text>
        <Text style={styles.headerTitle}>TERRITORY CLAIMED!</Text>
        <Text style={styles.headerSubtitle}>Your run is saved</Text>
      </View>

      {/* Map with route & territory */}
      {Platform.OS !== 'web' && routeCoords.length > 0 && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            customMapStyle={DARK_MAP_STYLE}
            initialRegion={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {territoryCoords.length > 0 && (
              <Polygon
                coordinates={territoryCoords}
                fillColor={colors.fill}
                strokeColor={colors.stroke}
                strokeWidth={2}
              />
            )}
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#00F0FF"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>
      )}

      {/* Stats */}
      <Animated.View
        style={[
          styles.statsCard,
          {
            transform: [{ scale: scaleAnim }],
            opacity: celebrateAnim,
          },
        ]}
      >
        <View style={styles.statRow}>
          <SummaryStatItem
            label="DISTANCE"
            value={`${(run?.distanceKm || 0).toFixed(2)} km`}
            icon="📍"
          />
          <SummaryStatItem
            label="DURATION"
            value={formatDuration(run?.durationSeconds || 0)}
            icon="⏱️"
          />
          <SummaryStatItem
            label="AVG PACE"
            value={`${formatPace(run?.avgPaceMinPerKm || 0)}/km`}
            icon="⚡"
          />
        </View>

        <View style={styles.divider} />

        {/* Territory gained */}
        <View style={styles.territoryGained}>
          <Text style={styles.territoryLabel}>NEW TERRITORY CLAIMED</Text>
          <Text style={styles.territoryValue}>
            {territoryGainedKm2 < 0.001
              ? `${Math.round(territoryGainedKm2 * 1000000)} m²`
              : `${territoryGainedKm2.toFixed(4)} km²`
            }
          </Text>
          <Text style={styles.territoryEmoji}>🗺️</Text>
        </View>
      </Animated.View>

      {/* Territory stolen */}
      {territoryStolenFrom && territoryStolenFrom.length > 0 && (
        <View style={styles.stolenCard}>
          <Text style={styles.stolenTitle}>⚔️ TERRITORY CONQUERED!</Text>
          {territoryStolenFrom.map((stolen: any, i: number) => (
            <View key={i} style={styles.stolenRow}>
              <Text style={styles.stolenText}>
                Stole{' '}
                <Text style={styles.stolenArea}>
                  {stolen.areaKm2 < 0.001
                    ? `${Math.round(stolen.areaKm2 * 1000000)} m²`
                    : `${stolen.areaKm2.toFixed(4)} km²`
                  }
                </Text>
                {' '}from{' '}
                <Text style={styles.stolenFrom}>@{stolen.username}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleBackToMap}
          data-testid="back-to-map-button"
        >
          <Text style={styles.primaryButtonText}>VIEW MY TERRITORY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace('/run/active')}
        >
          <Text style={styles.secondaryButtonText}>RUN AGAIN</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 32 }} />
    </ScrollView>
  );
}

function SummaryStatItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  noDataText: {
    color: '#888',
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    padding: 32,
    paddingBottom: 16,
  },
  headerEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 3,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  mapContainer: {
    marginHorizontal: 16,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  statsCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statIcon: {
    fontSize: 22,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  statLabel: {
    color: '#555',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 16,
  },
  territoryGained: {
    alignItems: 'center',
    gap: 4,
  },
  territoryLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  territoryValue: {
    color: '#00FF88',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 1,
  },
  territoryEmoji: {
    fontSize: 28,
  },
  stolenCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#2A0A14',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FF336640',
    gap: 10,
  },
  stolenTitle: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stolenRow: {
    paddingLeft: 8,
  },
  stolenText: {
    color: '#CCCCCC',
    fontSize: 14,
    lineHeight: 22,
  },
  stolenArea: {
    color: '#FF3366',
    fontWeight: '800',
  },
  stolenFrom: {
    color: '#FF8888',
    fontWeight: '700',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#00FF88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  backButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
  },
  backButtonText: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
