import { getToken } from './auth';

// Use full backend URL for API calls on all platforms
const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function getHeaders(withAuth = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (withAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

async function request<T>(path: string, options: RequestInit = {}, withAuth = true): Promise<T> {
  const headers = await getHeaders(withAuth);
  const response = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Request failed');
  }
  return data as T;
}

export const api = {
  // Auth
  register: (username: string, email: string, password: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }, false),

  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }, false),

  getMe: () => request('/auth/me'),

  // Runs
  startRun: () => request('/runs/start', { method: 'POST' }),

  endRun: (runId: string, coordinates: number[][]) =>
    request('/runs/end', { method: 'POST', body: JSON.stringify({ runId, coordinates }) }),

  getUserRuns: (userId: string) => request(`/runs/${userId}`),

  getRunDetail: (runId: string) => request(`/runs/detail/${runId}`),

  // Territories
  getTerritories: (minLng: number, minLat: number, maxLng: number, maxLat: number) =>
    request(`/territories?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`),

  getUserTerritories: (userId: string) => request(`/territories/user/${userId}`),

  // Leaderboard
  getGlobalLeaderboard: () => request('/leaderboard/global'),

  // FIX 4: Local leaderboard
  getLocalLeaderboard: (lat: number, lng: number, radiusKm: number = 20) =>
    request(`/leaderboard/local?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`),

  // Profile
  getUserProfile: (userId: string) => request(`/users/${userId}/profile`),

  updateProfile: (userId: string, data: { username?: string; avatarUrl?: string }) =>
    request(`/users/${userId}/profile`, { method: 'PUT', body: JSON.stringify(data) }),

  // Badges
  getUserBadges: (userId: string) => request(`/badges/${userId}`),
  getAllBadgeDefinitions: () => request('/badges/definitions/all'),

  // Competition
  getCurrentCompetition: () => request('/competition/current'),

  // Notifications
  savePushToken: (token: string, platform: string) =>
    request('/users/push-token', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  getNotifications: () => request('/notifications'),
  markNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),
};
