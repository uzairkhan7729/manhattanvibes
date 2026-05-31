import { useEffect, useRef, useState } from 'react';

import { API_BASE } from './config';

export type NetState = 'online' | 'degraded' | 'offline';

interface SyncStatus {
  net: NetState;
  queueDepth: number;
  lastDrain: { ts: number; applied: number; failed: number; conflicts: number } | null;
}

/**
 * Network state machine + sync loop. Hits /health/ready every 10s.
 *   - 200 OK three times in a row → online (drain every 5s)
 *   - timeout once → degraded (drain every 30s)
 *   - three failures → offline (no drain)
 */
export function useSync(accessToken: string | null): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({ net: 'offline', queueDepth: 0, lastDrain: null });
  const failuresRef = useRef(0);

  // Periodic queue depth refresh
  useEffect(() => {
    let cancelled = false;
    async function refreshDepth(): Promise<void> {
      if (cancelled) return;
      const depth = await window.mv.outbox.depth().catch(() => 0);
      setStatus((s) => ({ ...s, queueDepth: depth }));
    }
    void refreshDepth();
    const t = setInterval(() => { void refreshDepth(); }, 2_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Health probe + drain loop
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const r = await fetch(`${API_BASE}/health/ready`, { signal: AbortSignal.timeout(3_000) });
        if (r.ok) {
          failuresRef.current = 0;
          setStatus((s) => ({ ...s, net: 'online' }));
          const result = await window.mv.outbox.drain(API_BASE, accessToken);
          setStatus((s) => ({
            ...s, lastDrain: { ts: Date.now(), ...result },
            queueDepth: Math.max(0, s.queueDepth - result.applied - result.failed - result.conflicts),
          }));
        } else {
          throw new Error(`HTTP ${r.status}`);
        }
      } catch {
        failuresRef.current += 1;
        setStatus((s) => ({ ...s, net: failuresRef.current >= 3 ? 'offline' : 'degraded' }));
      }
    };
    void tick();
    const id = setInterval(() => { void tick(); }, 5_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [accessToken]);

  return status;
}
