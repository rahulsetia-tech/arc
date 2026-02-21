/**
 * Generate a unique color for a user based on their ID.
 */
export function userColor(userId: string): { fill: string; stroke: string; hex: string } {
  let hash = 0;
  const str = String(userId);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  const rgb = hslToRgb(hue, 70, 55);
  const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
  return {
    fill: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.3)`,
    stroke: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1.0)`,
    hex: hex,
  };
}

export function myTerritoryColor(): { fill: string; stroke: string; hex: string } {
  return {
    fill: 'rgba(0, 255, 136, 0.3)',
    stroke: 'rgba(0, 255, 136, 1.0)',
    hex: '#00FF88',
  };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert GeoJSON polygon coordinates [[lng, lat]] to react-native-maps format [{latitude, longitude}]
 */
export function geoJsonToMapCoords(coords: number[][]): { latitude: number; longitude: number }[] {
  return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

/**
 * Format area for display
 */
export function formatArea(km2: number): string {
  if (km2 < 0.01) return `${Math.round(km2 * 1000000)} m²`;
  if (km2 < 1) return `${(km2 * 1000).toFixed(0)} km × m`;
  return `${km2.toFixed(3)} km²`;
}

/**
 * Format pace (min/km)
 */
export function formatPace(paceMinPerKm: number): string {
  if (!paceMinPerKm || paceMinPerKm <= 0) return '--:--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Haversine distance between two [lng, lat] coords in km
 */
export function haversineDistance(coord1: number[], coord2: number[]): number {
  const R = 6371;
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;
  const dlat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dlng = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(Math.max(0, a)));
}

export function calculateRouteDistance(coordinates: number[][]): number {
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += haversineDistance(coordinates[i], coordinates[i + 1]);
  }
  return total;
}
