// Native summary map - react-native-maps with route + territory
import React from 'react';
import MapView, { Polyline, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Platform } from 'react-native';
import { DARK_MAP_STYLE } from '../constants/mapStyles';
import { myTerritoryColor } from '../utils/geo';

interface Coord {
  latitude: number;
  longitude: number;
}

interface SummaryMapProps {
  routeCoords: Coord[];
  territoryCoords: Coord[];
  region: any;
}

export function SummaryMap({ routeCoords, territoryCoords, region }: SummaryMapProps) {
  const colors = myTerritoryColor();
  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={DARK_MAP_STYLE}
      initialRegion={region}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      {territoryCoords.length > 2 && (
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
  );
}
