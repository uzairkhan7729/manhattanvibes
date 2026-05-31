/**
 * Simple auth — uses the same /auth endpoints as everything else.
 * Token persists in localStorage so a kiosk refresh doesn't kick the user out.
 */
import { useEffect, useState } from 'react';

interface User { id: string; fullName: { en: string }; role: string }

interface State { user: User | null; accessToken: string | null }

const KEY = 'mv-kds-auth';

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as State) : { user: null, accessToken: null };
  } catch {
    return { user: null, accessToken: null };
  }
}

const listeners = new Set<() => void>();
let state: State = load();

function setState(next: State): void {
  state = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useAuth(): State & { login(identifier: string, password: string): Promise<void>; clear(): void } {
  const [_, force] = useState({});
  useEffect(() => {
    const l = (): void => force({});
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  return {
    ...state,
    async login(identifier, password) {
      const r = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!r.ok) throw new Error((await r.json() as { detail?: string }).detail ?? `HTTP ${r.status}`);
      const data = await r.json() as { accessToken: string; user: { id: string } };
      const me = await fetch('/api/v1/auth/me', { headers: { authorization: `Bearer ${data.accessToken}` } }).then((res) => res.json() as Promise<User>);
      setState({ user: me, accessToken: data.accessToken });
    },
    clear() { setState({ user: null, accessToken: null }); },
  };
}
