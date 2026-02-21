// Native map for home screen - uses react-native-maps
// FIX 1: initialRegion prop + forwardRef for map animation
// FIX 6: MultiPolygon support
import React from 'react';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Platform } from 'react-native';
import { DARK_MAP_STYLE } from '../constants/mapStyles';
import { geoJsonToMapCoords, myTerritoryColor, userColor } from '../utils/geo';

interface Territory {
  id: string;
  userId: string;
  username: string;
  polygon: { type: string; coordinates: number[][][] | number[][][][] };
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

const DEFAULT_REGION = {
  latitude: 51.5074,
  longitude: -0.1278,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export const TerritoryMap = React.forwardRef<MapView, TerritoryMapProps>(
  ({ territories, currentUserId, onRegionChange, onTerritoryPress, initialRegion }, ref) => {
    const region = initialRegion || DEFAULT_REGION;

    return (
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={region}
        onRegionChangeComplete={onRegionChange}
      >
        {territories.map((territory) => {
          if (!territory.polygon?.coordinates) return null;
          const isMyTerritory = territory.userId === currentUserId;
          const colors = isMyTerritory ? myTerritoryColor() : userColor(territory.userId);

          // FIX 6: Handle both Polygon and MultiPolygon
          if (territory.polygon.type === 'MultiPolygon') {
            // MultiPolygon: coordinates is number[][][][]
            const multiCoords = territory.polygon.coordinates as number[][][][];
            return multiCoords.map((polyCoords, idx) => {
              if (!polyCoords?.[0]) return null;
              const coords = geoJsonToMapCoords(polyCoords[0] as number[][]);
              return (
                <Polygon
                  key={`${territory.id}-${idx}`}
                  coordinates={coords}
                  fillColor={colors.fill}
                  strokeColor={colors.stroke}
                  strokeWidth={isMyTerritory ? 2.5 : 1.5}
                  tappable
                  onPress={() => onTerritoryPress(territory)}
                />
              );
            });
          }

          // Standard Polygon
          if (!territory.polygon.coordinates[0]) return null;
          const coords = geoJsonToMapCoords(territory.polygon.coordinates[0] as number[][]);
          return (
            <Polygon
              key={territory.id}
              coordinates={coords}
              fillColor={colors.fill}
              strokeColor={colors.stroke}
              strokeWidth={isMyTerritory ? 2.5 : 1.5}
              tappable
              onPress={() => onTerritoryPress(territory)}
            />
          );
        })}
      </MapView>
    );
  }
);

TerritoryMap.displayName = 'TerritoryMap';
