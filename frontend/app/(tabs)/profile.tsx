import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { api } from '../../src/utils/api';
import { getUser, clearAuth } from '../../src/utils/auth';
import { formatDuration } from '../../src/utils/geo';

interface Run {
  id: string;
  distanceKm: number;
  durationSeconds: number;
  avgPaceMinPerKm: number;
  territoryGainedKm2: number;
  territoryStolenFrom: any[];
  startedAt: string;
  endedAt: string;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getUser().then((u) => {
      setUser(u);
      if (u) loadProfile(u.id);
    });
  }, []);

  async function loadProfile(userId: string) {
    try {
      setLoading(true);
      const [profileData, runsData, badgesData] = await Promise.all([
        api.getUserProfile(userId) as any,
        api.getUserRuns(userId) as any,
        api.getUserBadges(userId) as any,
      ]);
      setProfile(profileData);
      setRuns(runsData || []);
      setBadges(badgesData || []);
    } catch (err) {
      console.log('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!user) return;
    setRefreshing(true);
    await loadProfile(user.id);
    setRefreshing(false);
  }

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  function formatPaceDisplay(pace: number): string {
    if (!pace || pace <= 0) return '--:--';
    const mins = Math.floor(pace);
    const secs = Math.round((pace - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  const displayData = profile || user;

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#00FF88" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#00FF88"
          colors={['#00FF88']}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { borderColor: displayData?.color || '#00FF88' }]}>
            <Text style={styles.avatarText}>
              {(displayData?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={styles.username}>{displayData?.username || 'Runner'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
        {profile?.globalRank > 0 && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>RANK #{profile.globalRank}</Text>
          </View>
        )}
        <Text style={styles.memberSince}>
          Member since {formatDate(displayData?.createdAt || '')}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          label="RUNS"
          value={String(displayData?.totalRuns || 0)}
          icon="🏃"
        />
        <StatCard
          label="DISTANCE"
          value={`${(displayData?.totalDistanceKm || 0).toFixed(1)} km`}
          icon="📍"
        />
        <StatCard
          label="TERRITORY"
          value={`${(displayData?.totalAreaKm2 || 0).toFixed(3)} km²`}
          icon="🗺️"
          accent
        />
        <StatCard
          label="GLOBAL RANK"
          value={profile?.globalRank > 0 ? `#${profile.globalRank}` : '--'}
          icon="🏆"
        />
      </View>

      {/* Recent Runs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT RUNS</Text>
        {runs.length === 0 ? (
          <View style={styles.emptyRuns}>
            <Text style={styles.emptyRunsText}>No runs yet. Start your first run!</Text>
            <TouchableOpacity
              style={styles.startRunButton}
              onPress={() => router.push('/run/active')}
            >
              <Text style={styles.startRunButtonText}>START RUNNING</Text>
            </TouchableOpacity>
          </View>
        ) : (
          runs.slice(0, 10).map((run) => (
            <View key={run.id} style={styles.runCard}>
              <View style={styles.runCardLeft}>
                <Text style={styles.runDate}>{formatDate(run.endedAt || run.startedAt)}</Text>
                <View style={styles.runStats}>
                  <Text style={styles.runStat}>{(run.distanceKm || 0).toFixed(2)} km</Text>
                  <Text style={styles.runStatDivider}>·</Text>
                  <Text style={styles.runStat}>{formatDuration(run.durationSeconds || 0)}</Text>
                  <Text style={styles.runStatDivider}>·</Text>
                  <Text style={styles.runStat}>{formatPaceDisplay(run.avgPaceMinPerKm)}/km</Text>
                </View>
              </View>
              <View style={styles.runCardRight}>
                <Text style={styles.runTerritory}>
                  +{run.territoryGainedKm2 < 0.001
                    ? `${Math.round((run.territoryGainedKm2 || 0) * 1000000)} m²`
                    : `${(run.territoryGainedKm2 || 0).toFixed(4)} km²`
                  }
                </Text>
                {run.territoryStolenFrom?.length > 0 && (
                  <Text style={styles.runStolen}>⚔️ stole</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Logout Button */}
      <View style={styles.logoutSection}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          testID="logout-button"
        >
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: insets.bottom + 16 }} />
    </ScrollView>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
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
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#00FF88',
  },
  username: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  email: {
    fontSize: 13,
    color: '#555',
    marginTop: 4,
  },
  rankBadge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#00FF88',
    marginTop: 12,
  },
  rankText: {
    color: '#00FF88',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  memberSince: {
    color: '#555',
    fontSize: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 6,
  },
  statCardAccent: {
    borderColor: '#00FF8840',
    backgroundColor: '#0D2A1A',
  },
  statIcon: {
    fontSize: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statValueAccent: {
    color: '#00FF88',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 2,
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#555',
    letterSpacing: 3,
    marginBottom: 12,
  },
  emptyRuns: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    gap: 12,
  },
  emptyRunsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
  startRunButton: {
    backgroundColor: '#00FF88',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  startRunButtonText: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  runCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  runCardLeft: {
    flex: 1,
  },
  runDate: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  runStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  runStat: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  runStatDivider: {
    color: '#444',
    fontSize: 12,
  },
  runCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  runTerritory: {
    color: '#00FF88',
    fontSize: 14,
    fontWeight: '800',
  },
  runStolen: {
    color: '#FF3366',
    fontSize: 11,
  },
  logoutSection: {
    padding: 16,
    paddingTop: 8,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#FF3366',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
