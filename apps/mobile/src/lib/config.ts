import Constants from 'expo-constants';

const apiBase = (Constants.expoConfig?.extra as { apiBase?: string } | undefined)?.apiBase ?? 'http://localhost:8088';

export const API_BASE = apiBase;
