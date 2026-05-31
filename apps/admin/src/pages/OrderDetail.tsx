import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, RotateCcw, Truck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import { api, ApiError } from '../lib/api';
import { fmtDate, fmtSAR } from '../lib/format';

interface OrderItem {
  productId: string;
  productSnapshot: { name: { en: string; ar?: string }; sku: string };
  qty: number; sizeCode?: string; crustCode?: string;
  unitPrice: number; lineTotal: number;
  modifiers: Array<{ type: string; unitPrice: number; qty: number }>;
  notes?: string;
}
interface Order {
  _id: string; orderNumber: string; state: string; channel: string; type: string;
  customerId?: string; tableId?: string; createdAt: string;
  items: OrderItem[];
  pricing: { subtotal: number; discountTotal: number; deliveryFee: number; vat: number; tip: number; total: number; vatRate: number };
  payments: string[]; paymentStatus: string;
  audit?: { transitions?: Array<{ from: string; to: string; ts: string; reason?: string }> };
}

/**
 * Compute the next state + button affordance for an order. Order-type-aware
 * because delivery has an OUT_FOR_DELIVERY hop that pickup/takeaway/dinein skip.
 */
function nextAction(order: Order): { to: string; label: string; icon: React.ComponentType<{ className?: string }> } | null {
  switch (order.state) {
    case 'CREATED':           return { to: 'CONFIRMED',        label: 'Accept order',       icon: CheckCircle2 };
    case 'CONFIRMED':         return { to: 'PREPARING',        label: 'Start preparing',    icon: RotateCcw };
    case 'PREPARING':         return { to: 'BAKING',           label: 'Move to baking',     icon: RotateCcw };
    case 'BAKING':            return { to: 'READY',            label: 'Mark ready',         icon: CheckCircle2 };
    case 'READY':
      return order.type === 'delivery'
        ? { to: 'OUT_FOR_DELIVERY', label: 'Out for delivery', icon: Truck }
        : { to: 'CLOSED',           label: 'Close order',      icon: CheckCircle2 };
    case 'OUT_FOR_DELIVERY':  return { to: 'DELIVERED',        label: 'Mark delivered',     icon: CheckCircle2 };
    case 'DELIVERED':         return { to: 'CLOSED',           label: 'Close order',        icon: CheckCircle2 };
    default:                  return null;
  }
}

const stateBadge: Record<string, string> = {
  CREATED:           'bg-slate-100 text-slate-700',
  CONFIRMED:         'bg-blue-100 text-blue-700',
  PREPARING:         'bg-amber-100 text-amber-700',
  BAKING:            'bg-orange-100 text-orange-700',
  READY:             'bg-emerald-100 text-emerald-700',
  OUT_FOR_DELIVERY:  'bg-violet-100 text-violet-700',
  DELIVERED:         'bg-green-100 text-green-700',
  CLOSED:            'bg-slate-200 text-slate-700',
  CANCELLED:         'bg-red-100 text-red-700',
  REFUNDED:          'bg-rose-100 text-rose-700',
};

export function OrderDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: !!id,
    refetchInterval: 5000,                  // keep status fresh while the page is open
    refetchIntervalInBackground: true,      // …even if the admin tab is blurred
  });

  const transition = useMutation({
    mutationFn: (to: string) => api.post(`/orders/${id}/transition`, { to }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }),
  });
  const cancel = useMutation({
    mutationFn: (reason: string) => api.post(`/orders/${id}/cancel`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }),
  });

  if (query.isLoading) return <div className="p-8 text-slate-500">Loading…</div>;
  if (query.isError)   return <div className="p-8 text-red-600">{query.error instanceof ApiError ? query.error.message : 'Error'}</div>;
  const order = query.data!;
  const action = nextAction(order);
  const canCancel = !['CANCELLED', 'REFUNDED', 'CLOSED', 'DELIVERED'].includes(order.state);

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
            <span className={`badge ${stateBadge[order.state] ?? ''}`}>{order.state}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">{order.channel.toUpperCase()} · {order.type} · {fmtDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {action && (
            <button
              className="btn-primary"
              disabled={transition.isPending}
              onClick={() => transition.mutate(action.to)}
              title={`Transitions order to ${action.to}`}
            >
              <action.icon className="h-4 w-4" />
              {transition.isPending ? 'Working…' : action.label}
            </button>
          )}
          {canCancel && (
            <button
              className="btn-danger"
              disabled={cancel.isPending}
              onClick={() => {
                const r = window.prompt('Cancellation reason?');
                if (r) cancel.mutate(r);
              }}
            >
              <XCircle className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      </header>

      {/* Payment-pending banner for CREATED orders */}
      {order.state === 'CREATED' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-3">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <strong>New order awaiting acceptance.</strong> Payment status is <em>{order.paymentStatus}</em>.
            Click <strong>Accept order</strong> to confirm and start the kitchen flow. For card orders, payment captures via the gateway webhook; for cash you can collect on pickup/delivery.
          </div>
        </div>
      )}

      {transition.isError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {transition.error instanceof ApiError ? transition.error.message : 'Could not advance the order'}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <section className="card">
            <h2 className="px-5 py-3 border-b border-slate-200 font-semibold">Items</h2>
            <ul>
              {order.items.map((it, i) => (
                <li key={i} className="px-5 py-3 border-b border-slate-100 last:border-0">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="font-medium">{it.qty}× {it.productSnapshot.name.en}</div>
                      <div className="text-xs text-slate-500 space-x-2">
                        {it.sizeCode && <span>size {it.sizeCode}</span>}
                        {it.crustCode && <span>· crust {it.crustCode}</span>}
                        {it.modifiers.length > 0 && <span>· {it.modifiers.length} modifier(s)</span>}
                      </div>
                      {it.notes && <div className="text-xs text-slate-500 italic">"{it.notes}"</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{fmtSAR(it.lineTotal)}</div>
                      <div className="text-xs text-slate-500">{fmtSAR(it.unitPrice)} ea</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {order.audit?.transitions && order.audit.transitions.length > 0 && (
            <section className="card">
              <h2 className="px-5 py-3 border-b border-slate-200 font-semibold">Timeline</h2>
              <ul className="px-5 py-3 space-y-2 text-sm">
                {order.audit.transitions.map((t, i) => (
                  <li key={i} className="flex justify-between text-slate-600">
                    <span>{t.from} → <strong className="text-slate-900">{t.to}</strong>{t.reason && <em className="ml-2 text-slate-500">— {t.reason}</em>}</span>
                    <span className="text-slate-500">{fmtDate(t.ts)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h3 className="font-semibold mb-3">Pricing</h3>
            <dl className="space-y-1 text-sm">
              <Row label="Subtotal" value={fmtSAR(order.pricing.subtotal)} />
              <Row label="Discount" value={fmtSAR(-order.pricing.discountTotal)} />
              <Row label="Delivery" value={fmtSAR(order.pricing.deliveryFee)} />
              <Row label={`VAT (${order.pricing.vatRate}%, inc.)`} value={fmtSAR(order.pricing.vat)} />
              <Row label="Tip" value={fmtSAR(order.pricing.tip)} />
              <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{fmtSAR(order.pricing.total)}</span>
              </div>
            </dl>
          </section>
          <section className="card p-5">
            <h3 className="font-semibold mb-2">Status</h3>
            <p className="text-sm">State: <strong>{order.state}</strong></p>
            <p className="text-sm">Payment: <strong className="capitalize">{order.paymentStatus}</strong></p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
