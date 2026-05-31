import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';

import type { KdsOrder } from '../lib/use-kds-queue';

interface ColumnProps {
  title: string;
  color: 'slate' | 'amber' | 'orange' | 'emerald';
  orders: KdsOrder[];
  onBump: (id: string) => void;
  now: Date;
}

const colorMap = {
  slate:   { border: 'border-l-slate-400',   bg: 'bg-slate-800',  pill: 'bg-slate-700 text-slate-100' },
  amber:   { border: 'border-l-amber-400',   bg: 'bg-amber-950',  pill: 'bg-amber-900 text-amber-100' },
  orange:  { border: 'border-l-orange-500',  bg: 'bg-orange-950', pill: 'bg-orange-900 text-orange-100' },
  emerald: { border: 'border-l-emerald-400', bg: 'bg-emerald-950',pill: 'bg-emerald-900 text-emerald-100' },
} as const;

export function Column({ title, color, orders, onBump, now }: ColumnProps): JSX.Element {
  const c = colorMap[color];
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="col-header px-2">
        <span>{title}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs ${c.pill}`}>{orders.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {orders.length === 0 ? (
          <div className="text-center text-slate-600 text-sm py-12">—</div>
        ) : (
          orders.map((o) => <OrderCard key={o._id} order={o} accent={c} onBump={onBump} now={now} />)
        )}
      </div>
    </div>
  );
}

function OrderCard({ order, accent, onBump, now }: { order: KdsOrder; accent: { border: string; bg: string }; onBump: (id: string) => void; now: Date }): JSX.Element {
  const placed = new Date(order.createdAt);
  const ageMin = Math.floor((now.getTime() - placed.getTime()) / 60_000);
  const sla = ageMin > 12 ? 'late' : ageMin > 8 ? 'warn' : 'ok';
  return (
    <article
      className={clsx(
        'order-card cursor-pointer hover:brightness-110',
        accent.bg,
        accent.border,
        sla === 'late' && 'ring-2 ring-red-500',
        sla === 'warn' && 'ring-1 ring-amber-400',
      )}
      onClick={() => onBump(order._id)}
      title="Click to bump"
    >
      <header className="flex items-baseline justify-between mb-2">
        <div className="font-bold text-lg">{order.orderNumber}</div>
        <div className={clsx('text-sm font-mono', sla === 'late' ? 'text-red-400' : sla === 'warn' ? 'text-amber-300' : 'text-slate-300')}>
          {ageMin >= 1 ? `${ageMin}m` : 'just now'}
        </div>
      </header>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-2">{order.type}</div>
      <ul className="space-y-1 text-sm">
        {order.items.slice(0, 6).map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-bold text-orange-300">{it.qty}×</span>
            <span className="flex-1">
              {it.productSnapshot?.name?.en}
              {(it.sizeCode || it.crustCode) && (
                <span className="text-xs text-slate-400"> · {it.sizeCode}{it.crustCode ? `/${it.crustCode}` : ''}</span>
              )}
              {it.notes && <em className="text-xs text-yellow-300 block">"{it.notes}"</em>}
            </span>
          </li>
        ))}
        {order.items.length > 6 && <li className="text-xs text-slate-500 italic">+ {order.items.length - 6} more</li>}
      </ul>
      <footer className="mt-3 flex items-center justify-end text-xs text-slate-400">
        <ChevronRight className="h-3 w-3" /> bump
      </footer>
    </article>
  );
}
