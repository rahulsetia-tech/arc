// Native running map - uses react-native-maps
import React from 'react';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Platform } from 'react-native';
import { DARK_MAP_STYLE } from '../constants/mapStyles';

interface Coord {
  latitude: number;
  longitude: number;
}

interface RunningMapProps {
  coords: Coord[];
  region: any;
}

export function RunningMap({ coords, region }: RunningMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={DARK_MAP_STYLE}
      region={region}
      showsUserLocation
      followsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
    >
      {coords.length > 1 && (
        <Polyline
          coordinates={coords}
          strokeColor="#00F0FF"
          strokeWidth={4}
        />
      )}
    </MapView>
  );
}
