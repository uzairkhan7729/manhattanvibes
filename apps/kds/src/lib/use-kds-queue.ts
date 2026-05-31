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

/**
 * Maintains the live kitchen queue. Initial state via REST; updates via Socket.IO.
 * On `state_changed`, the order is moved between buckets (or removed if terminal).
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

    const onChanged = (msg: { id: string; orderNumber: string; state: string; from?: string; to?: string }): void => {
      const fromKey = msg.from ? stateBucket[msg.from] : null;
      const toKey = stateBucket[msg.state];

      setQueue((q) => {
        // Find existing order across buckets
        let found: KdsOrder | undefined;
        const next: Buckets = { incoming: [...q.incoming], preparing: [...q.preparing], baking: [...q.baking], ready: [...q.ready] };
        for (const k of Object.keys(next) as Array<keyof Buckets>) {
          const idx = next[k].findIndex((o) => o._id === msg.id);
          if (idx >= 0) {
            [found] = next[k].splice(idx, 1);
          }
        }
        if (toKey && found) {
          next[toKey] = [{ ...found, state: msg.state }, ...next[toKey]];
        }
        return next;
      });
    };

    sock.on('order.created',      onChanged);
    sock.on('order.confirmed',    (msg: { id: string; orderNumber: string; state: string }) => {
      // New confirmed order — pull full doc and place in incoming
      fetch(`/api/v1/orders/${msg.id}`, { headers: { authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json())
        .then((doc: KdsOrder) => setQueue((q) => ({ ...q, incoming: [doc, ...q.incoming.filter((o) => o._id !== doc._id)] })))
        .catch(() => undefined);
    });
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
