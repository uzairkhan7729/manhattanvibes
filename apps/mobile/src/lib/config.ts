import Constants from 'expo-constants';

/**
 * Detect the API base URL. Priority:
 *   1. EXPO_PUBLIC_API_BASE env at build time
 *   2. extra.apiBase from app.config.js (if non-localhost)
 *   3. Auto-derive from Metro's host (works on real phones + emulators)
 *   4. Fall back to http://localhost:8088
 *
 * In dev, Expo Go connects to Metro at the dev server's LAN IP — we reuse
 * the same IP for our API since both run on the same dev machine.
 */
function detectApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE) return process.env.EXPO_PUBLIC_API_BASE;

  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string };
  if (extra.apiBase && !/localhost|127\.0\.0\.1/i.test(extra.apiBase)) return extra.apiBase;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    '';
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host && !/localhost|127\.0\.0\.1/i.test(host)) return `http://${host}:8088`;
  }
  return 'http://localhost:8088';
}

export const API_BASE = detectApiBase();
