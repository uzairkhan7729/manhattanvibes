import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { fmtDate, fmtSAR } from '../lib/format';

interface OrderRow {
  _id: string;
  orderNumber: string;
  branchId: string;
  channel: string;
  type: string;
  state: string;
  paymentStatus: string;
  pricing: { total: number };
  createdAt: string;
}

const STATES = ['', 'CREATED', 'CONFIRMED', 'PREPARING', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'CANCELLED', 'REFUNDED'] as const;

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

export function OrdersPage(): JSX.Element {
  const [state, setState] = useState<string>('');
  const orders = useQuery({
    queryKey: ['orders', state],
    queryFn: () => api.get<{ items: OrderRow[] }>(`/orders${state ? `?state=${state}` : ''}`),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-slate-500">Live ordering activity across all branches.</p>
        </div>
        <select className="input w-48" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map((s) => <option key={s} value={s}>{s || 'All states'}</option>)}
        </select>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left">
              <Th>Order #</Th>
              <Th>State</Th>
              <Th>Type</Th>
              <Th>Channel</Th>
              <Th>Payment</Th>
              <Th>Total</Th>
              <Th>Placed</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {orders.isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
            {orders.data?.items.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No orders</td></tr>}
            {orders.data?.items.map((o) => (
              <tr key={o._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <Td><Link className="font-medium text-brand-600 hover:underline" to={`/orders/${o._id}`}>{o.orderNumber}</Link></Td>
                <Td><span className={`badge ${stateBadge[o.state] ?? ''}`}>{o.state}</span></Td>
                <Td className="capitalize">{o.type}</Td>
                <Td className="capitalize">{o.channel}</Td>
                <Td className="capitalize">{o.paymentStatus}</Td>
                <Td>{fmtSAR(o.pricing?.total)}</Td>
                <Td className="text-slate-500">{fmtDate(o.createdAt)}</Td>
                <Td>
                  <Link className="text-xs text-brand-600 hover:underline" to={`/orders/${o._id}`}>view</Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }): JSX.Element {
  return <th className="px-4 py-3 font-semibold text-slate-700">{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }): JSX.Element {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
