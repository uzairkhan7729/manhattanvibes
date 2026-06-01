import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mv:apiBaseOverride';

/**
 * Detect the API base URL. Priority:
 *   1. Persisted in-app override (Settings screen)
 *   2. EXPO_PUBLIC_API_BASE env at build time
 *   3. extra.apiBase from app.config.js (if non-localhost)
 *   4. Auto-derive from Metro's host (works on real phones + emulators)
 *   5. Fall back to http://localhost:8088 (last resort)
 */
function fromMetro(): string | null {
  const candidates: Array<string | undefined> = [
    Constants.expoConfig?.hostUri,
    (Constants as unknown as { expoGoConfig?: { hostUri?: string } }).expoGoConfig?.hostUri,
    (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost,
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } }).manifest2?.extra?.expoGo?.debuggerHost,
  ];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const cleaned = c.replace(/^.*:\/\//, '');
    const host = cleaned.split(':')[0];
    if (host && !/^localhost$|^127\.0\.0\.1$/.test(host)) return `http://${host}:8088`;
  }
  return null;
}

function detectInitial(): string {
  if (process.env.EXPO_PUBLIC_API_BASE) return process.env.EXPO_PUBLIC_API_BASE;
  const extra = (Constants.expoConfig?.extra ?? {}) as { apiBase?: string };
  if (extra.apiBase && !/localhost|127\.0\.0\.1/i.test(extra.apiBase)) return extra.apiBase;
  return fromMetro() ?? 'http://localhost:8088';
}

let _current = detectInitial();
const listeners = new Set<() => void>();
function notify(): void { listeners.forEach((l) => l()); }

export function getApiBase(): string { return _current; }

export const AUTO_DETECTED = detectInitial();

export async function setApiBaseOverride(url: string): Promise<void> {
  _current = url.replace(/\/+$/, '');
  notify();
  await AsyncStorage.setItem(STORAGE_KEY, _current).catch(() => undefined);
}

export async function clearApiBaseOverride(): Promise<void> {
  _current = detectInitial();
  notify();
  await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
}

/** Call once at app boot to apply any persisted override. */
export async function loadApiBaseOverride(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    if (v) { _current = v; notify(); }
  } catch { /* ignore */ }
}

export function useApiBase(): string {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => _current,
    () => _current,
  );
}

export function diagnostics(): Record<string, string | null> {
  return {
    current: _current,
    autoDetected: AUTO_DETECTED,
    expoConfigHostUri: Constants.expoConfig?.hostUri ?? null,
    expoGoHostUri: (Constants as unknown as { expoGoConfig?: { hostUri?: string } }).expoGoConfig?.hostUri ?? null,
    manifestDebuggerHost: (Constants as unknown as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ?? null,
    envOverride: process.env.EXPO_PUBLIC_API_BASE ?? null,
  };
}
