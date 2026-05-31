import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Manhattan Vibes',
  slug: 'manhattan-vibes',
  scheme: 'manhattanvibes',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'sa.manhattanvibes.app',
    supportsTablet: true,
  },
  android: {
    package: 'sa.manhattanvibes.app',
    adaptiveIcon: { backgroundColor: '#f97316' },
  },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
  extra: {
    apiBase: process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8088',
  },
};

export default config;
