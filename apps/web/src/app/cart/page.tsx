'use client';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { apiPost } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';
import { productImage } from '@/lib/images';

interface Quote {
  subtotal: number; discountTotal: number; deliveryFee: number;
  vatRate: number; vat: number; tip: number; total: number;
  lines: Array<{ productId: string; qty: number; unitPrice: number; lineTotal: number }>;
}

export default function CartPage(): JSX.Element {
  const cart = useCart();

  const quoteQ = useQuery({
    queryKey: ['quote', cart.lines, cart.branchId],
    enabled: cart.lines.length > 0 && !!cart.branchId,
    queryFn: () => apiPost<Quote>('/orders/quote', {
      branchId: cart.branchId,
      channel: 'web',
      type: 'pickup',
      items: cart.lines.map((l) => ({
        productId: l.productId,
        qty: l.qty,
        sizeCode: l.sizeCode,
        crustCode: l.crustCode,
        toppingIds: l.toppingIds,
        sauceIds: l.sauceIds,
        notes: l.notes,
      })),
    }),
  });

  if (cart.lines.length === 0) {
    return (
      <div className="container-x py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface p-12 text-center max-w-md mx-auto shadow-card"
        >
          <div className="h-20 w-20 mx-auto rounded-2xl bg-brand-100 grid place-items-center text-brand-600 mb-5">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold">Your cart is empty</h1>
          <p className="text-stone-500 mt-2">Browse the menu to get started.</p>
          <Link href="/menu" className="btn-primary mt-6">View menu</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container-x py-10 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
      <section>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-extrabold mb-2"
        >
          Your cart
        </motion.h1>
        <p className="text-stone-500 mb-8">{cart.lines.reduce((s, l) => s + l.qty, 0)} item(s)</p>

        <ul className="surface divide-y divide-stone-100 shadow-card overflow-hidden">
          <AnimatePresence initial={false}>
            {cart.lines.map((l) => (
              <motion.li
                key={l.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -80, height: 0, padding: 0 }}
                transition={{ type: 'spring', stiffness: 250, damping: 28 }}
                className="p-4 flex gap-4 items-start"
              >
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-xl overflow-hidden bg-stone-100">
                  <Image
                    src={productImage(undefined, undefined)}
                    alt={l.productName}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-ink-900 truncate">{l.productName}</h3>
                      <div className="text-xs text-stone-500 mt-0.5 space-x-2">
                        {l.sizeCode  && <span>size {l.sizeCode}</span>}
                        {l.crustCode && <span>· crust {l.crustCode}</span>}
                        {l.toppingIds && l.toppingIds.length > 0 && <span>· {l.toppingIds.length} toppings</span>}
                        {l.sauceIds   && l.sauceIds.length > 0   && <span>· {l.sauceIds.length} sauces</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <motion.div key={l.qty} initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="font-extrabold">
                        {fmtSAR(l.estimatedUnitPrice * l.qty)}
                      </motion.div>
                      <div className="text-xs text-stone-400">{fmtSAR(l.estimatedUnitPrice)} each</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="inline-flex items-center bg-stone-100 rounded-full">
                      <button onClick={() => cart.setQty(l.id, l.qty - 1)} className="h-8 w-8 rounded-full grid place-items-center hover:bg-stone-200 transition" aria-label="decrease">
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-4 text-sm font-bold min-w-[2ch] text-center">{l.qty}</span>
                      <button onClick={() => cart.setQty(l.id, l.qty + 1)} className="h-8 w-8 rounded-full grid place-items-center hover:bg-stone-200 transition" aria-label="increase">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button onClick={() => cart.remove(l.id)} className="text-stone-400 hover:text-red-600 transition text-sm inline-flex items-center gap-1">
                      <Trash2 className="h-4 w-4" /> remove
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <div className="mt-6">
          <Link href="/menu" className="btn-secondary">← Add more items</Link>
        </div>
      </section>

      <aside className="lg:sticky lg:top-24 self-start">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface p-6 shadow-card"
        >
          <h2 className="font-bold text-lg mb-4">Order summary</h2>
          {quoteQ.isLoading && (
            <div className="space-y-2">
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
            </div>
          )}
          {quoteQ.data && (
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={fmtSAR(quoteQ.data.subtotal)} />
              {quoteQ.data.discountTotal > 0 && (
                <Row label="Discount" value={`− ${fmtSAR(quoteQ.data.discountTotal)}`} positive />
              )}
              {quoteQ.data.deliveryFee > 0 && (
                <Row label="Delivery" value={fmtSAR(quoteQ.data.deliveryFee)} />
              )}
              <Row label={`VAT (${quoteQ.data.vatRate}%, inc.)`} value={fmtSAR(quoteQ.data.vat)} muted />
              <div className="border-t border-stone-200 mt-3 pt-3 flex justify-between items-baseline">
                <span className="font-bold">Total</span>
                <motion.span
                  key={quoteQ.data.total}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-extrabold text-ink-900"
                >
                  {fmtSAR(quoteQ.data.total)}
                </motion.span>
              </div>
            </dl>
          )}
          <Link href="/checkout" className="btn-primary w-full mt-5">
            Continue to checkout <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-[11px] text-center text-stone-500 mt-3">
            Secure checkout · Mada · Apple Pay · STC Pay · Cash on pickup
          </p>
        </motion.div>
      </aside>
    </div>
  );
}

function Row({ label, value, muted, positive }: { label: string; value: string; muted?: boolean; positive?: boolean }): JSX.Element {
  return (
    <div className="flex justify-between">
      <dt className={muted ? 'text-stone-500' : 'text-stone-600'}>{label}</dt>
      <dd className={`font-semibold ${positive ? 'text-emerald-600' : muted ? 'text-stone-500' : 'text-ink-900'}`}>{value}</dd>
    </div>
  );
}
