// Web fallback for summary map
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Coord {
  latitude: number;
  longitude: number;
}

interface SummaryMapProps {
  routeCoords: Coord[];
  territoryCoords: Coord[];
  region: any;
}

export function SummaryMap({ routeCoords }: SummaryMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🗺️</Text>
      <Text style={styles.text}>Route: {routeCoords.length} points</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1B2A',
    gap: 8,
  },
  icon: { fontSize: 40 },
  text: { color: '#888', fontSize: 13 },
});
