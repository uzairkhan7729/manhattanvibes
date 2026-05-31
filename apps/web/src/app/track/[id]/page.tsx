'use client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ChefHat, Clock, Package, Truck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtSAR } from '@/lib/format';

const STEPS: Array<{ key: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'CONFIRMED',        label: 'Confirmed',         icon: CheckCircle2 },
  { key: 'PREPARING',        label: 'Preparing',         icon: ChefHat },
  { key: 'BAKING',           label: 'Baking',            icon: ChefHat },
  { key: 'READY',            label: 'Ready',             icon: Package },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery',  icon: Truck },
  { key: 'DELIVERED',        label: 'Delivered',         icon: CheckCircle2 },
];

interface Order { _id: string; orderNumber: string; state: string; type: string; pricing: { total: number }; createdAt: string }

export default function TrackPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const auth = useAuth();

  const orderQ = useQuery({
    queryKey: ['track', id],
    queryFn: () => apiGet<Order>(`/orders/${id}`, auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : undefined),
    refetchInterval: 5_000,
    enabled: !!id,
  });

  // Live updates via Socket.IO /tracking
  useEffect(() => {
    if (!id) return;
    const sock = io('/tracking', { transports: ['websocket', 'polling'] });
    sock.emit('join', { orderId: id });
    sock.on('order.state_changed', () => orderQ.refetch().catch(() => undefined));
    return () => { sock.disconnect(); };
  }, [id, orderQ]);

  if (orderQ.isLoading) return <div className="max-w-2xl mx-auto px-4 py-12 text-slate-500">Loading…</div>;
  if (orderQ.isError)   return <div className="max-w-2xl mx-auto px-4 py-12 text-red-600">Could not load order.</div>;
  const order = orderQ.data!;
  const visibleSteps = order.type === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'OUT_FOR_DELIVERY');
  const currentIdx = visibleSteps.findIndex((s) => s.key === order.state);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Order {order.orderNumber}</h1>
        <p className="text-sm text-slate-500 capitalize">{order.type} · {fmtSAR(order.pricing.total)}</p>
      </header>

      <div className="card p-6">
        <ol className="space-y-4">
          {visibleSteps.map((s, i) => {
            const reached = i <= currentIdx;
            const now = i === currentIdx;
            return (
              <li key={s.key} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full grid place-items-center ${
                  reached ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-400'
                } ${now ? 'ring-4 ring-brand-100' : ''}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${reached ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</div>
                  {now && <div className="text-xs text-brand-600">In progress…</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-4 text-center text-sm text-slate-500 flex items-center justify-center gap-1">
        <Clock className="h-4 w-4" /> Updates live — refresh on its own.
      </div>
    </div>
  );
}
