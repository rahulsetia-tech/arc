// Web fallback for running map
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Coord {
  latitude: number;
  longitude: number;
}

interface RunningMapProps {
  coords: Coord[];
  region: any;
}

export function RunningMap({ coords }: RunningMapProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🏃</Text>
      <Text style={styles.text}>GPS tracking active</Text>
      <Text style={styles.subtext}>{coords.length} points collected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D1B2A',
    gap: 12,
  },
  icon: { fontSize: 48 },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtext: {
    color: '#888',
    fontSize: 13,
  },
});
