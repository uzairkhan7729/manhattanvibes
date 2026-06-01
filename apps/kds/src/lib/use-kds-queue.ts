import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

export interface KdsOrder {
  _id: string;
  orderNumber: string;
  state: string;
  type: string;
  pricing?: { total: number };
  items: Array<{ qty: number; productSnapshot?: { name: { en: string; ar?: string } }; sizeCode?: string; crustCode?: string; notes?: string }>;
  createdAt: string;
}

interface Buckets {
  incoming: KdsOrder[];
  preparing: KdsOrder[];
  baking: KdsOrder[];
  ready: KdsOrder[];
}

const empty: Buckets = { incoming: [], preparing: [], baking: [], ready: [] };

const stateBucket: Record<string, keyof Buckets | null> = {
  CONFIRMED: 'incoming',
  PREPARING: 'preparing',
  BAKING:    'baking',
  READY:     'ready',
  OUT_FOR_DELIVERY: null,
  DELIVERED: null,
  CLOSED:    null,
  CANCELLED: null,
};

/** Shape of an order event payload from the server's /kds namespace. */
interface KdsEvent {
  id: string;
  orderNumber: string;
  state: string;
  type?: string;
  total?: number;
  createdAt?: string;
  items?: KdsOrder['items'];
  from?: string;
  to?: string;
}

function fromEvent(msg: KdsEvent): KdsOrder | null {
  if (!msg.type || !msg.createdAt || !msg.items) return null;
  return {
    _id: msg.id,
    orderNumber: msg.orderNumber,
    state: msg.state,
    type: msg.type,
    pricing: typeof msg.total === 'number' ? { total: msg.total } : undefined,
    items: msg.items,
    createdAt: msg.createdAt,
  };
}

/**
 * Maintains the live kitchen queue. Initial state via REST; updates via Socket.IO.
 *
 * Transitions:
 *   - non-KDS state -> KDS state : add from event payload (no HTTP fetch)
 *   - KDS state -> KDS state     : move between buckets, keep existing copy
 *   - KDS state -> non-KDS state : remove from buckets
 */
export function useKdsQueue(branchId: string, accessToken: string): {
  queue: Buckets;
  connected: boolean;
  bump: (orderId: string) => Promise<void>;
} {
  const [queue, setQueue] = useState<Buckets>(empty);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initial snapshot
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/v1/kds/queue?branchId=${branchId}`, { headers: { authorization: `Bearer ${accessToken}` } });
      if (r.ok && !cancelled) {
        const data = await r.json() as { buckets: { incoming: KdsOrder[]; preparing: KdsOrder[]; baking: KdsOrder[]; ready: KdsOrder[] } };
        setQueue(data.buckets);
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [branchId, accessToken]);

  // Socket.IO subscription
  useEffect(() => {
    const sock = io('/kds', {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = sock;

    sock.on('connect', () => {
      setConnected(true);
      sock.emit('join', { branchId, station: 'all' });
    });
    sock.on('disconnect', () => setConnected(false));

    const onChanged = (msg: KdsEvent): void => {
      const toKey = stateBucket[msg.state] ?? null;

      setQueue((q) => {
        // Find + remove from any current bucket
        let found: KdsOrder | undefined;
        const next: Buckets = {
          incoming: [...q.incoming],
          preparing: [...q.preparing],
          baking: [...q.baking],
          ready: [...q.ready],
        };
        for (const k of Object.keys(next) as Array<keyof Buckets>) {
          const idx = next[k].findIndex((o) => o._id === msg.id);
          if (idx >= 0) [found] = next[k].splice(idx, 1);
        }

        if (toKey === null) {
          // Terminal / non-KDS state — already removed above, nothing more to do.
          return next;
        }

        if (found) {
          // Already had it; move with updated state.
          next[toKey] = [{ ...found, state: msg.state }, ...next[toKey]];
        } else {
          // Order is entering a KDS bucket for the first time (e.g. CREATED -> CONFIRMED).
          // Build the card from the event payload — no HTTP fetch needed.
          const fresh = fromEvent(msg);
          if (fresh) next[toKey] = [fresh, ...next[toKey]];
        }
        return next;
      });
    };

    sock.on('order.created',       onChanged);
    sock.on('order.confirmed',     onChanged);   // payload now carries items + createdAt
    sock.on('order.state_changed', onChanged);
    sock.on('order.ready',         onChanged);
    sock.on('order.cancelled',     onChanged);

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [branchId, accessToken]);

  const bump = useCallback(async (orderId: string) => {
    await fetch(`/api/v1/kds/bump/${orderId}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  }, [accessToken]);

  return { queue, connected, bump };
}
