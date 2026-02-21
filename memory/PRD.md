# SUPERACRES - Gamified GPS Running App

## Product Vision
Turn every run/walk into a live territory-capture game on a real-world map.
Think Strava meets Risk meets Pokémon Go.

## Core Loop
1. User starts run → GPS tracking begins
2. Route creates territory polygon (50m buffer around route)
3. Territory saved on shared global map in user's color
4. Other users can steal territory by running through it
5. Leaderboard ranks by total territory area (km²)

## Technical Stack
- **Backend**: FastAPI + MongoDB (Motor) + Shapely + PyProj
- **Frontend**: Expo Router + React Native + react-native-maps + expo-location

## Screens Built
1. **Auth**: Login + Register (JWT-based)
2. **Map Home**: Territory map, START RUN button, territory callouts
3. **Active Run**: GPS tracking, route polyline, stats bar
4. **Run Summary**: Post-run stats, territory gained/stolen
5. **Leaderboard**: Global rankings by territory area
6. **Profile**: User stats, run history, logout

## Key API Endpoints
- POST /api/auth/register, /api/auth/login
- POST /api/runs/start, /api/runs/end
- GET /api/territories?bbox
- GET /api/leaderboard/global
- GET /api/users/:id/profile
- GET /api/test/territory (for testing)

## Architecture
- Territory computation: Shapely buffer(50m), difference, union
- Colors: HSL hash from userId
- Geospatial: MongoDB 2dsphere indexes
- Platform-specific map: .native.tsx/.web.tsx for react-native-maps

## Status: MVP Complete (Phase 1-3)
