// Web fallback for territory map
// FIX 1: initialRegion prop added for consistency
// FIX 6: MultiPolygon handling (display count)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Territory {
  id: string;
  userId: string;
  username: string;
  polygon: any;
  areaKm2: number;
  color: string;
  capturedAt: string;
}

interface TerritoryMapProps {
  territories: Territory[];
  currentUserId?: string;
  onRegionChange: (region: any) => void;
  onTerritoryPress: (territory: Territory) => void;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

export const TerritoryMap = React.forwardRef<any, TerritoryMapProps>(({ territories }, _ref) => {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.title}>TERRITORY MAP</Text>
      <Text style={styles.subtitle}>Open in Expo Go on mobile to see the live map</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{territories.length} territories active</Text>
      </View>
    </View>
  );
});

TerritoryMap.displayName = 'TerritoryMap';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1B2A',
    gap: 16,
    padding: 32,
  },
  icon: { fontSize: 64 },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#00FF8840',
  },
  badgeText: {
    color: '#00FF88',
    fontSize: 13,
    fontWeight: '700',
  },
});
