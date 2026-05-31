'use client';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2, CircleDollarSign, CreditCard, Phone as PhoneIcon, ShoppingBag, Smartphone, Store, Truck, User as UserIcon, Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiPost, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';

type OrderType = 'pickup' | 'delivery';
type PayMethod = 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay';

const PAY_METHODS: Array<{ key: PayMethod; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'mada',       label: 'Mada',       icon: CreditCard },
  { key: 'visa',       label: 'Visa',       icon: CreditCard },
  { key: 'mastercard', label: 'MasterCard', icon: CreditCard },
  { key: 'applepay',   label: 'Apple Pay',  icon: Smartphone },
  { key: 'stcpay',     label: 'STC Pay',    icon: Wallet },
  { key: 'cash',       label: 'Cash',       icon: CircleDollarSign },
];

export default function CheckoutPage(): JSX.Element {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [type, setType] = useState<OrderType>('pickup');
  const [method, setMethod] = useState<PayMethod>('cash');
  const [phone, setPhone] = useState('+966555000099');
  const [name, setName] = useState('Guest');
  const [error, setError] = useState<string | null>(null);

  // Business logic is unchanged — same mutation as before.
  const placeMut = useMutation({
    mutationFn: async () => {
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
      const intent = await apiPost<{ paymentId: string }>(
        '/payments/intent',
        { orderId: order._id, method, amount: order.pricing.total },
        { authorization: `Bearer ${token}` },
      );
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
      <div className="container-x py-24 text-center max-w-md mx-auto">
        <ShoppingBag className="h-10 w-10 text-stone-300 mx-auto" />
        <h1 className="text-2xl font-extrabold mt-4">Nothing to checkout</h1>
        <p className="text-stone-500 mt-2">Add items first.</p>
      </div>
    );
  }

  const subtotalEst = cart.lines.reduce((s, l) => s + l.estimatedUnitPrice * l.qty, 0);
  const steps = ['Type', 'Contact', 'Payment'];

  return (
    <div className="container-x py-10 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-extrabold">Checkout</h1>
        <p className="text-stone-500 mt-2">Almost there — review and confirm.</p>
      </motion.div>

      {/* Stepper */}
      <div className="flex items-center gap-3 mb-10">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-3 flex-1">
            <div className="h-9 w-9 rounded-full bg-brand-500 text-white grid place-items-center font-bold text-sm shadow-glow">
              {i + 1}
            </div>
            <div className="text-sm font-semibold">{s}</div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-stone-200" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6">
          <Card title="1. Order type">
            <div className="grid grid-cols-2 gap-3">
              <TypeTile active={type === 'pickup'}   icon={Store} label="Pickup"    desc="Ready in 12 min"   onClick={() => setType('pickup')} />
              <TypeTile active={type === 'delivery'} icon={Truck} label="Delivery"  desc="~25–35 min · 9 SAR" onClick={() => setType('delivery')} />
            </div>
          </Card>

          <Card title="2. Contact">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name" icon={UserIcon}>
                <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Phone (E.164)" icon={PhoneIcon}>
                <input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+966555..." />
              </Field>
            </div>
            <p className="text-xs text-stone-500 mt-3">
              We'll text you an OTP if you're new — first order is on us with code <strong>WELCOME50</strong>.
            </p>
          </Card>

          <Card title="3. Payment">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PAY_METHODS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={`group relative p-4 rounded-2xl border text-left transition ${
                    method === key
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 shadow-glow'
                      : 'border-stone-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${method === key ? 'text-brand-600' : 'text-stone-500'}`} />
                  <div className="mt-2 font-semibold text-sm">{label}</div>
                  {method === key && <CheckCircle2 className="absolute top-3 right-3 h-4 w-4 text-brand-600" />}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Summary aside */}
        <aside className="lg:sticky lg:top-24 self-start">
          <div className="surface p-6 shadow-card">
            <h2 className="font-bold text-lg mb-4">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-stone-600">Items</dt><dd className="font-semibold">{cart.lines.reduce((s, l) => s + l.qty, 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-600">Estimated subtotal</dt><dd className="font-semibold">{fmtSAR(subtotalEst)}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-600">Order type</dt><dd className="font-semibold capitalize">{type}</dd></div>
              <div className="flex justify-between"><dt className="text-stone-600">Payment</dt><dd className="font-semibold uppercase">{method}</dd></div>
            </dl>
            <button
              onClick={() => { setError(null); placeMut.mutate(); }}
              disabled={placeMut.isPending}
              className="btn-primary w-full mt-6 py-3 text-base"
            >
              {placeMut.isPending ? 'Placing your order…' : 'Place order'}
            </button>
            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error}
              </motion.div>
            )}
            <p className="text-[11px] text-stone-500 mt-3 text-center">
              By placing this order you agree to our terms. VAT 15% inclusive.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="surface p-6 shadow-card"
    >
      <h2 className="font-bold text-lg mb-4">{title}</h2>
      {children}
    </motion.section>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <label className="text-xs text-stone-500 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}

function TypeTile({ active, icon: Icon, label, desc, onClick }: { active: boolean; icon: React.ComponentType<{ className?: string }>; label: string; desc: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`group relative p-5 rounded-2xl border text-left transition ${
        active
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30 shadow-glow'
          : 'border-stone-200 bg-white hover:border-brand-300'
      }`}
    >
      <div className={`h-10 w-10 rounded-xl grid place-items-center ${active ? 'bg-brand-500 text-white' : 'bg-stone-100 text-stone-600 group-hover:bg-brand-100 group-hover:text-brand-600'} transition`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 font-bold">{label}</div>
      <div className="text-xs text-stone-500">{desc}</div>
      {active && <CheckCircle2 className="absolute top-3 right-3 h-5 w-5 text-brand-600" />}
    </button>
  );
}
