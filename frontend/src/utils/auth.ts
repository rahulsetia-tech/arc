import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'superacres_token';
const USER_KEY = 'superacres_user';

export interface User {
  id: string;
  username: string;
  email: string;
  color: string;
  totalAreaKm2: number;
  totalDistanceKm: number;
  totalRuns: number;
  globalRank?: number;
  createdAt?: string;
}

export async function saveAuth(token: string, user: User): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<User | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}
