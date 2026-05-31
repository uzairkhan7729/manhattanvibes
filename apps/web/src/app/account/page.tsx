'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtSAR } from '@/lib/format';

interface Me { id: string; fullName: { en: string; ar?: string }; phone: string; email?: string }
interface Loyalty { tier: string; pointsBalance: number; lifetimeSpendHalalas: number }
interface OrderRow { _id: string; orderNumber: string; state: string; createdAt: string; pricing: { total: number } }

export default function AccountPage(): JSX.Element {
  const auth = useAuth();
  const me = useQuery({
    queryKey: ['me'],
    enabled: !!auth.accessToken,
    queryFn: () => apiGet<Me>('/auth/me', { authorization: `Bearer ${auth.accessToken!}` }),
  });
  const loyalty = useQuery({
    queryKey: ['loyalty-me'],
    enabled: !!auth.accessToken,
    queryFn: () => apiGet<Loyalty>('/loyalty/me', { authorization: `Bearer ${auth.accessToken!}` }),
  });
  const orders = useQuery({
    queryKey: ['my-orders'],
    enabled: !!auth.accessToken && !!auth.userId,
    queryFn: () => apiGet<{ items: OrderRow[] }>(`/orders?customerId=${auth.userId}&limit=20`, { authorization: `Bearer ${auth.accessToken!}` }),
  });

  if (!auth.accessToken) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-slate-500 mt-2">Sign in or sign up via your phone — we'll send you an OTP at checkout.</p>
        <Link href="/menu" className="btn-primary mt-6">Start an order</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Hi {me.data?.fullName.en ?? 'there'}</h1>
        <p className="text-sm text-slate-500">{me.data?.phone}</p>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-2">Loyalty</h2>
        {loyalty.data ? (
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold text-brand-600">{loyalty.data.pointsBalance}</div>
              <div className="text-xs text-slate-500">points · tier <strong className="capitalize">{loyalty.data.tier}</strong></div>
            </div>
            <div className="text-sm text-slate-500">Lifetime spend: <strong className="text-slate-900">{fmtSAR(loyalty.data.lifetimeSpendHalalas)}</strong></div>
          </div>
        ) : <div className="text-sm text-slate-500">Loading…</div>}
      </section>

      <section className="card">
        <h2 className="font-semibold px-5 py-3 border-b border-slate-200">Order history</h2>
        <ul>
          {orders.data?.items.length === 0 && <li className="px-5 py-6 text-sm text-slate-500 text-center">No orders yet</li>}
          {orders.data?.items.map((o) => (
            <li key={o._id} className="px-5 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between">
              <div>
                <Link href={`/track/${o._id}`} className="font-medium text-brand-600 hover:underline">{o.orderNumber}</Link>
                <div className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleString('en-SA', { timeZone: 'Asia/Riyadh' })}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{fmtSAR(o.pricing.total)}</div>
                <div className="text-xs text-slate-500">{o.state}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <button onClick={() => { auth.clear(); window.location.reload(); }} className="btn-ghost">Sign out</button>
    </div>
  );
}
