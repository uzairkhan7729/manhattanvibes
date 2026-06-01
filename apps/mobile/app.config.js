// Plain JS so Expo's config evaluator can require() it without a TS
// transpile step (npx-resolved expo doesn't always have ts-node available
// before deps are installed).

/** @type {import('@expo/config-types').ExpoConfig} */
module.exports = {
  name: 'Manhattan Vibes',
  slug: 'manhattan-vibes',
  scheme: 'manhattanvibes',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  // Custom branded splash. We keep the native splash brief, then a React-rendered
  // splash takes over for the rest of the JS boot (see app/_layout.tsx).
  splash: {
    backgroundColor: '#0c0a09',
    resizeMode: 'cover',
  },
  ios: {
    bundleIdentifier: 'sa.manhattanvibes.app',
    supportsTablet: true,
  },
  android: {
    package: 'sa.manhattanvibes.app',
    adaptiveIcon: { backgroundColor: '#f97316' },
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0c0a09',
        image: undefined,
        resizeMode: 'cover',
        imageWidth: 200,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    // Falls back to localhost; the runtime auto-detects the Metro host IP
    // (see src/lib/config.ts) so a real phone can reach the dev API.
    apiBase: process.env.EXPO_PUBLIC_API_BASE || '',
  },
};
