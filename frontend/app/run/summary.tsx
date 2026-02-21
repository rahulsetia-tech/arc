import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDuration, formatPace, geoJsonToMapCoords } from '../../src/utils/geo';
import { SummaryMap } from '../../src/components/SummaryMap';

export default function RunSummaryScreen() {
  const insets = useSafeAreaInsets();
  const [runResult, setRunResult] = useState<any>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadResult();
  }, []);

  useEffect(() => {
    if (runResult) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]).start();
    }
  }, [runResult]);

  async function loadResult() {
    try {
      const raw = await AsyncStorage.getItem('last_run_result');
      if (raw) setRunResult(JSON.parse(raw));
    } catch (err) {
      console.log('Summary load error:', err);
    }
  }

  if (!runResult) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.noDataText}>No run data found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)')}>
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

  let mapRegion = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  if (routeCoords.length > 0) {
    const lats = routeCoords.map((c: any) => c.latitude);
    const lngs = routeCoords.map((c: any) => c.longitude);
    mapRegion = {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
      latitudeDelta: Math.max(Math.max(...lats) - Math.min(...lats), 0.005) * 2.5,
      longitudeDelta: Math.max(Math.max(...lngs) - Math.min(...lngs), 0.005) * 2.5,
    };
  }

  const territoryGained = run?.territoryGainedKm2 || 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>TERRITORY CLAIMED!</Text>
        <Text style={styles.subtitle}>Your ground is secured</Text>
      </View>

      {/* Map */}
      {routeCoords.length > 0 && (
        <View style={styles.mapContainer}>
          <SummaryMap
            routeCoords={routeCoords}
            territoryCoords={territoryCoords}
            region={mapRegion}
          />
        </View>
      )}

      {/* Stats card */}
      <Animated.View
        style={[styles.statsCard, { transform: [{ scale: scaleAnim }], opacity: fadeAnim }]}
      >
        <View style={styles.statRow}>
          <SummaryStat label="DISTANCE" value={`${(run?.distanceKm || 0).toFixed(2)} km`} icon="📍" />
          <SummaryStat label="TIME" value={formatDuration(run?.durationSeconds || 0)} icon="⏱️" />
          <SummaryStat label="PACE" value={`${formatPace(run?.avgPaceMinPerKm || 0)}/km`} icon="⚡" />
        </View>

        <View style={styles.divider} />

        <View style={styles.territory}>
          <Text style={styles.territoryLabel}>NEW TERRITORY CLAIMED</Text>
          <Text style={styles.territoryValue}>
            {territoryGained < 0.001
              ? `${Math.round(territoryGained * 1000000)} m²`
              : `${territoryGained.toFixed(4)} km²`}
          </Text>
          <Text style={styles.mapEmoji}>🗺️</Text>
        </View>
      </Animated.View>

      {/* Territory stolen */}
      {territoryStolenFrom?.length > 0 && (
        <View style={styles.stolenCard}>
          <Text style={styles.stolenTitle}>⚔️ CONQUERED!</Text>
          {territoryStolenFrom.map((stolen: any, i: number) => (
            <Text key={i} style={styles.stolenText}>
              Stole{' '}
              <Text style={styles.stolenArea}>
                {stolen.areaKm2 < 0.001
                  ? `${Math.round(stolen.areaKm2 * 1000000)} m²`
                  : `${stolen.areaKm2.toFixed(4)} km²`}
              </Text>
              {' from '}
              <Text style={styles.stolenFrom}>@{stolen.username}</Text>
            </Text>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(tabs)')}
          testID="back-to-map-button"
        >
          <Text style={styles.primaryBtnText}>VIEW MY TERRITORY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/run/active')}
        >
          <Text style={styles.secondaryBtnText}>RUN AGAIN</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 32 }} />
    </ScrollView>
  );
}

function SummaryStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  header: { alignItems: 'center', padding: 32, paddingBottom: 16 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: {
    fontSize: 28, fontWeight: '900', color: '#00FF88',
    letterSpacing: 3, textAlign: 'center',
  },
  subtitle: { fontSize: 14, color: '#888', marginTop: 8 },
  mapContainer: {
    marginHorizontal: 16,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 16,
  },
  statsCard: {
    margin: 16, marginTop: 0,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', flex: 1, gap: 4 },
  statIcon: { fontSize: 22 },
  statValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  statLabel: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  divider: { height: 1, backgroundColor: '#2A2A2A', marginVertical: 16 },
  territory: { alignItems: 'center', gap: 4 },
  territoryLabel: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  territoryValue: { color: '#00FF88', fontSize: 36, fontWeight: '900', letterSpacing: 1 },
  mapEmoji: { fontSize: 28 },
  stolenCard: {
    margin: 16, marginTop: 0,
    backgroundColor: '#2A0A14',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FF336640',
    gap: 10,
  },
  stolenTitle: { color: '#FF3366', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  stolenText: { color: '#CCC', fontSize: 14, lineHeight: 22 },
  stolenArea: { color: '#FF3366', fontWeight: '800' },
  stolenFrom: { color: '#FF8888', fontWeight: '700' },
  actions: { padding: 16, gap: 12 },
  primaryBtn: {
    backgroundColor: '#00FF88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#0D0D0D', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  noDataText: { color: '#888', fontSize: 16 },
  backButton: { backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14 },
  backButtonText: { color: '#00FF88', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});
