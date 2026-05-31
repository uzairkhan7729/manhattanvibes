'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiPost, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';

type OrderType = 'pickup' | 'delivery';
type PayMethod = 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay';

export default function CheckoutPage(): JSX.Element {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [type, setType] = useState<OrderType>('pickup');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [phone, setPhone] = useState('+966555000099');
  const [name, setName] = useState('Guest');
  const [error, setError] = useState<string | null>(null);

  const placeMut = useMutation({
    mutationFn: async () => {
      // 1) ensure logged in — OTP-bootstrap if needed
      let token = auth.accessToken;
      let userId = auth.userId;
      if (!token) {
        const otp = await apiPost<{ devCode?: string }>('/auth/otp/request', { phone, purpose: 'login' });
        const v = await apiPost<{ accessToken: string; refreshToken: string; user: { id: string } }>(
          '/auth/otp/verify',
          { phone, code: otp.devCode ?? '000000', purpose: 'login' },
        );
        auth.setSession(v.user.id, v.accessToken, v.refreshToken);
        token = v.accessToken;
        userId = v.user.id;
      }
      // 2) place order
      const order = await apiPost<{ _id: string; pricing: { total: number } }>(
        '/orders',
        {
          branchId: cart.branchId,
          channel: 'web',
          type,
          items: cart.lines.map((l) => ({
            productId: l.productId, qty: l.qty,
            sizeCode: l.sizeCode, crustCode: l.crustCode,
            toppingIds: l.toppingIds, sauceIds: l.sauceIds, notes: l.notes,
          })),
          customerId: userId,
          guestInfo: { name, phone },
        },
        { authorization: `Bearer ${token}` },
      );
      // 3) create payment intent
      const intent = await apiPost<{ paymentId: string }>(
        '/payments/intent',
        { orderId: order._id, method, amount: order.pricing.total },
        { authorization: `Bearer ${token}` },
      );
      // 4) (sandbox path) immediately capture via webhook simulation —
      //    in real Mada/Apple Pay flow this would happen via the gateway callback.
      //    For dev, we just keep the order in CREATED state and let the customer
      //    pay in person. Surface the order id to the tracking page.
      return { orderId: order._id, paymentId: intent.paymentId };
    },
    onSuccess: ({ orderId }) => {
      cart.clear();
      router.push(`/track/${orderId}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Could not place order');
    },
  });

  if (cart.lines.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Nothing to checkout</h1>
        <p className="text-slate-500 mt-2">Add items first.</p>
      </div>
    );
  }

  const subtotalEst = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Checkout</h1>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Order type</h2>
        <div className="flex gap-2">
          {(['pickup', 'delivery'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
                    className={`px-4 py-2 rounded-md border text-sm capitalize ${type === t ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-300'}`}>{t}</button>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Contact</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">Name</label>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-slate-500">Phone (E.164)</label>
            <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966555..." />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3">Payment method</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(['cash', 'mada', 'visa', 'mastercard', 'applepay', 'stcpay'] as PayMethod[]).map((m) => (
            <button key={m} onClick={() => setMethod(m)}
                    className={`px-3 py-2 rounded-md border text-sm capitalize ${method === m ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-slate-300'}`}>
              {m}
            </button>
          ))}
        </div>
      </section>

      <div className="card p-5 flex items-center justify-between">
        <div className="text-sm text-slate-600">Estimated total <strong className="text-slate-900 text-base">{fmtSAR(subtotalEst)}</strong></div>
        <button onClick={() => { setError(null); placeMut.mutate(); }}
                disabled={placeMut.isPending} className="btn-primary px-6 py-3 text-base">
          {placeMut.isPending ? 'Placing…' : 'Place order'}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
