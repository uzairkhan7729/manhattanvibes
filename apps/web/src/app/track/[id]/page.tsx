'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChefHat, Clock, LogIn, Package, Truck } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

import { apiGet, ApiError } from '@/lib/api';
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
    queryKey: ['track', id, !!auth.accessToken],
    queryFn: () => apiGet<Order>(`/orders/${id}`, auth.accessToken ? { authorization: `Bearer ${auth.accessToken}` } : undefined),
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,    // poll even when tab is blurred
    enabled: !!id,
    retry: false,
  });

  // Live updates via Socket.IO /tracking (joins room order:<canonical-id>)
  useEffect(() => {
    if (!orderQ.data?._id) return;
    const sock = io('/tracking', { transports: ['websocket', 'polling'] });
    sock.emit('join', { orderId: orderQ.data._id });
    sock.on('order.state_changed', () => orderQ.refetch().catch(() => undefined));
    return () => { sock.disconnect(); };
  }, [orderQ.data?._id, orderQ]);

  if (orderQ.isLoading) {
    return (
      <div className="container-x py-16">
        <div className="surface p-8 max-w-2xl mx-auto shadow-card">
          <div className="skeleton h-7 w-64 mb-3" />
          <div className="skeleton h-4 w-40 mb-8" />
          <div className="space-y-4">
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
            <div className="skeleton h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (orderQ.isError) {
    const err = orderQ.error as ApiError | Error;
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <div className="container-x py-16">
        <div className="surface p-8 md:p-10 max-w-md mx-auto text-center shadow-card">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-amber-100 text-amber-700 grid place-items-center mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          {status === 401 ? (
            <>
              <h1 className="text-xl font-extrabold">Sign in to track this order</h1>
              <p className="text-stone-500 mt-2 text-sm">
                Your session expired. Use the same phone number you placed the order with.
              </p>
              <Link href="/account" className="btn-primary mt-6">
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
            </>
          ) : status === 404 ? (
            <>
              <h1 className="text-xl font-extrabold">Order not found</h1>
              <p className="text-stone-500 mt-2 text-sm">
                We couldn't find an order matching <code className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">{id}</code>.
                Double-check the order number on your receipt, or try the link from your confirmation message.
              </p>
              <Link href="/track" className="btn-secondary mt-6">Search again</Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold">Something went wrong</h1>
              <p className="text-stone-500 mt-2 text-sm">
                {err instanceof Error ? err.message : 'Please try again in a moment.'}
              </p>
              <button onClick={() => orderQ.refetch()} className="btn-primary mt-6">Retry</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const order = orderQ.data!;
  const visibleSteps = order.type === 'delivery' ? STEPS : STEPS.filter((s) => s.key !== 'OUT_FOR_DELIVERY');
  const currentIdx = visibleSteps.findIndex((s) => s.key === order.state);
  const isTerminal = ['CANCELLED', 'REFUNDED', 'CLOSED'].includes(order.state);

  return (
    <div className="container-x py-12 max-w-2xl">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <span className="pill-brand">Order tracking</span>
        <h1 className="text-3xl md:text-4xl font-extrabold mt-2">{order.orderNumber}</h1>
        <p className="text-stone-500 mt-1 capitalize">{order.type} · {fmtSAR(order.pricing.total)}</p>
      </motion.header>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="surface p-6 md:p-8 shadow-card"
      >
        {order.state === 'CREATED' && (
          <div className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>Waiting on the restaurant to accept your order.</strong> This usually happens within a minute or two.
          </div>
        )}
        {order.state === 'CANCELLED' && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            This order was <strong>cancelled</strong>. If you've been charged, the refund will appear within 3–5 business days.
          </div>
        )}

        <ol className="space-y-5">
          {visibleSteps.map((s, i) => {
            const reached = i <= currentIdx;
            const now = i === currentIdx;
            return (
              <li key={s.key} className="flex items-center gap-4">
                <div className={`relative w-12 h-12 rounded-2xl grid place-items-center transition-colors ${
                  reached ? 'bg-brand-500 text-white shadow-glow' : 'bg-stone-100 text-stone-400'
                }`}>
                  <s.icon className="h-5 w-5" />
                  {now && <span className="absolute -inset-1 rounded-2xl border-2 border-brand-300 animate-ping" />}
                </div>
                <div className="flex-1">
                  <div className={`font-semibold ${reached ? 'text-ink-900' : 'text-stone-400'}`}>{s.label}</div>
                  {now && <div className="text-xs text-brand-600 font-medium">In progress…</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </motion.div>

      {!isTerminal && (
        <div className="mt-4 text-center text-sm text-stone-500 flex items-center justify-center gap-1.5">
          <Clock className="h-4 w-4" /> Updates live — no need to refresh.
        </div>
      )}
    </div>
  );
}
