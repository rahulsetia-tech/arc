import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { api } from '../../src/utils/api';
import { getUser } from '../../src/utils/auth';
import { userColor } from '../../src/utils/geo';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  totalAreaKm2: number;
  totalDistanceKm: number;
  totalRuns: number;
  color: string;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // FIX 4: mode toggle state
  const [mode, setMode] = useState<'global' | 'local'>('global');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    getUser().then(setCurrentUser);
    // FIX 4: get user location on mount for local leaderboard
    fetchUserLocation();
    loadLeaderboard('global', null);
  }, []);

  async function fetchUserLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch {
      // silently fail — local leaderboard button will show a prompt
    }
  }

  async function loadLeaderboard(
    targetMode: 'global' | 'local',
    location: { lat: number; lng: number } | null
  ) {
    try {
      setLoading(true);
      let data: LeaderboardEntry[];
      if (targetMode === 'local' && location) {
        data = await api.getLocalLeaderboard(location.lat, location.lng) as LeaderboardEntry[];
      } else {
        data = await api.getGlobalLeaderboard() as LeaderboardEntry[];
      }
      setEntries(data);
    } catch (err) {
      console.log('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadLeaderboard(mode, userLocation);
    setRefreshing(false);
  }

  // FIX 4: Handle toggle between global and local
  function handleModeSwitch(newMode: 'global' | 'local') {
    if (newMode === mode) return;
    if (newMode === 'local' && !userLocation) {
      // Try to get location first
      fetchUserLocation().then(() => {
        setMode(newMode);
        loadLeaderboard(newMode, userLocation);
      });
      return;
    }
    setMode(newMode);
    loadLeaderboard(newMode, userLocation);
  }

  function getRankEmoji(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  function renderItem({ item }: { item: LeaderboardEntry }) {
    const isCurrentUser = item.id === currentUser?.id;
    const color = userColor(item.id);

    return (
      <View
        style={[styles.row, isCurrentUser && styles.myRow]}
        testID={`leaderboard-row-${item.rank}`}
      >
        <View style={styles.rankBadge}>
          <Text style={[styles.rankText, item.rank <= 3 && styles.rankTextTop]}>
            {getRankEmoji(item.rank)}
          </Text>
        </View>

        <View style={[styles.colorIndicator, { backgroundColor: color.hex }]} />

        <View style={styles.userInfo}>
          <Text style={[styles.username, isCurrentUser && styles.myUsername]}>
            {item.username}
            {isCurrentUser && ' (YOU)'}
          </Text>
          <Text style={styles.stats}>
            {item.totalRuns} runs · {item.totalDistanceKm.toFixed(1)} km
          </Text>
        </View>

        <View style={styles.areaContainer}>
          <Text style={[styles.area, isCurrentUser && styles.myArea]}>
            {item.totalAreaKm2 < 0.001
              ? `${Math.round(item.totalAreaKm2 * 1000000)} m²`
              : `${item.totalAreaKm2.toFixed(3)} km²`}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>LEADERBOARD</Text>
        <Text style={styles.subtitle}>
          {mode === 'global' ? 'Global Rankings by Territory' : 'Local Rankings (20km radius)'}
        </Text>
      </View>

      {/* FIX 4: Global / Local toggle bar */}
      <View style={styles.toggleBar}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'global' && styles.toggleBtnActive]}
          onPress={() => handleModeSwitch('global')}
          testID="toggle-global"
        >
          <Text style={[styles.toggleBtnText, mode === 'global' && styles.toggleBtnTextActive]}>
            🌍 GLOBAL
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'local' && styles.toggleBtnActive]}
          onPress={() => handleModeSwitch('local')}
          testID="toggle-local"
        >
          <Text style={[styles.toggleBtnText, mode === 'local' && styles.toggleBtnTextActive]}>
            📍 LOCAL
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00FF88" />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyTitle}>No Rankings Yet</Text>
          <Text style={styles.emptyText}>
            {mode === 'local'
              ? 'No runners with territory in your area yet. Start a run!'
              : 'Be the first to complete a run and claim territory!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00FF88"
              colors={['#00FF88']}
            />
          }
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>RANK</Text>
              <Text style={[styles.listHeaderText, { flex: 1, marginLeft: 60 }]}>RUNNER</Text>
              <Text style={styles.listHeaderText}>TERRITORY</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    letterSpacing: 1,
    marginTop: 4,
  },
  // FIX 4: Toggle bar styles
  toggleBar: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  toggleBtnActive: {
    backgroundColor: '#00FF88',
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1,
  },
  toggleBtnTextActive: {
    color: '#0D0D0D',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    gap: 8,
  },
  listHeader: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    paddingBottom: 12,
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2,
  },
  row: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  myRow: {
    borderColor: '#00FF88',
    backgroundColor: '#0D2A1A',
  },
  rankBadge: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
  },
  rankTextTop: {
    fontSize: 18,
  },
  colorIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  myUsername: {
    color: '#00FF88',
  },
  stats: {
    color: '#555',
    fontSize: 12,
    marginTop: 3,
  },
  areaContainer: {
    alignItems: 'flex-end',
  },
  area: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  myArea: {
    color: '#00FF88',
  },
});
