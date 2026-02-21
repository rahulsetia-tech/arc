// Native map for home screen - uses react-native-maps
import React from 'react';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet, Platform } from 'react-native';
import { DARK_MAP_STYLE } from '../constants/mapStyles';
import { geoJsonToMapCoords, myTerritoryColor, userColor } from '../utils/geo';

interface Territory {
  id: string;
  userId: string;
  username: string;
  polygon: { type: string; coordinates: number[][][] };
  areaKm2: number;
  color: string;
  capturedAt: string;
}

interface TerritoryMapProps {
  territories: Territory[];
  currentUserId?: string;
  onRegionChange: (region: any) => void;
  onTerritoryPress: (territory: Territory) => void;
}

export function TerritoryMap({ territories, currentUserId, onRegionChange, onTerritoryPress }: TerritoryMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      customMapStyle={DARK_MAP_STYLE}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      initialRegion={{
        latitude: 51.5074,
        longitude: -0.1278,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      onRegionChangeComplete={onRegionChange}
    >
      {territories.map((territory) => {
        if (!territory.polygon?.coordinates?.[0]) return null;
        const isMyTerritory = territory.userId === currentUserId;
        const colors = isMyTerritory ? myTerritoryColor() : userColor(territory.userId);
        const coords = geoJsonToMapCoords(territory.polygon.coordinates[0]);
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
