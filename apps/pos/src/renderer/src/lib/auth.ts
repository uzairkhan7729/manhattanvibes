import { useEffect, useState } from 'react';

import { API_BASE } from './config';

interface Session { user: { id: string; role: string; fullName: { en: string } } | null; accessToken: string | null; branchId: string | null }

const listeners = new Set<() => void>();
let cache: Session = { user: null, accessToken: null, branchId: null };

/**
 * Guard against the preload script having failed to load. When that happens,
 * window.mv is undefined and any access to .kv throws an opaque error mid-render.
 * Surface a clear error instead so the bug is obvious from the renderer side.
 */
function bridge(): NonNullable<Window['mv']> {
  const mv = (window as Window).mv;
  if (!mv) {
    throw new Error(
      'POS preload bridge (window.mv) is not available. ' +
      'The preload script failed to load — restart the Electron app, ' +
      'or check apps/pos/src/main/index.ts preload path.',
    );
  }
  return mv;
}

async function load(): Promise<void> {
  const raw = await bridge().kv.get('session');
  if (raw) cache = JSON.parse(raw) as Session;
  listeners.forEach((l) => l());
}

void load().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[pos.auth] failed to load session from local store:', err);
});

function save(): void {
  void bridge().kv.set('session', JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function useSession(): Session & {
  login(identifier: string, password: string): Promise<void>;
  setBranch(id: string): void;
  clear(): void;
} {
  const [, force] = useState({});
  useEffect(() => {
    const l = (): void => force({});
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return {
    ...cache,
    async login(identifier, password) {
      const r = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!r.ok) throw new Error((await r.json() as { detail?: string }).detail ?? `HTTP ${r.status}`);
      const data = await r.json() as { accessToken: string; user: { id: string } };
      const me = await fetch(`${API_BASE}/api/v1/auth/me`, { headers: { authorization: `Bearer ${data.accessToken}` } }).then((res) => res.json());
      cache = { ...cache, user: me, accessToken: data.accessToken };
      save();
    },
    setBranch(id) { cache = { ...cache, branchId: id }; save(); },
    clear() { cache = { user: null, accessToken: null, branchId: null }; save(); },
  };
}
