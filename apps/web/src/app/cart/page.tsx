'use client';
import { useQuery } from '@tanstack/react-query';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { apiPost } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';

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
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="text-slate-500 mt-2">Browse the menu to get started.</p>
        <Link href="/menu" className="btn-primary mt-6">View menu</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
      <section>
        <h1 className="text-2xl font-bold mb-4">Cart</h1>
        <ul className="card divide-y divide-slate-200">
          {cart.lines.map((l) => (
            <li key={l.id} className="p-4 flex items-start gap-4">
              <div className="flex-1">
                <div className="font-semibold">{l.productName}</div>
                <div className="text-xs text-slate-500 space-x-2">
                  {l.sizeCode && <span>size {l.sizeCode}</span>}
                  {l.crustCode && <span>· crust {l.crustCode}</span>}
                  {l.toppingIds && l.toppingIds.length > 0 && <span>· {l.toppingIds.length} toppings</span>}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <div className="inline-flex items-center border border-slate-300 rounded-md">
                    <button onClick={() => cart.setQty(l.id, l.qty - 1)} className="p-1.5 hover:bg-slate-100" aria-label="decrease"><Minus className="h-4 w-4" /></button>
                    <span className="px-3 text-sm font-medium">{l.qty}</span>
                    <button onClick={() => cart.setQty(l.id, l.qty + 1)} className="p-1.5 hover:bg-slate-100" aria-label="increase"><Plus className="h-4 w-4" /></button>
                  </div>
                  <button onClick={() => cart.remove(l.id)} className="text-slate-500 hover:text-red-600 text-sm inline-flex items-center gap-1">
                    <Trash2 className="h-4 w-4" /> remove
                  </button>
                </div>
              </div>
              <div className="text-right font-semibold">
                {fmtSAR(l.estimatedUnitPrice * l.qty)}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold mb-3">Summary</h2>
          {quoteQ.isLoading && <div className="text-sm text-slate-500">Pricing…</div>}
          {quoteQ.data && (
            <dl className="space-y-1 text-sm">
              <Row label="Subtotal" value={fmtSAR(quoteQ.data.subtotal)} />
              {quoteQ.data.discountTotal > 0 && <Row label="Discount" value={fmtSAR(-quoteQ.data.discountTotal)} />}
              {quoteQ.data.deliveryFee > 0 && <Row label="Delivery" value={fmtSAR(quoteQ.data.deliveryFee)} />}
              <Row label={`VAT (${quoteQ.data.vatRate}%, inc.)`} value={fmtSAR(quoteQ.data.vat)} />
              <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between text-base font-bold">
                <span>Total</span>
                <span>{fmtSAR(quoteQ.data.total)}</span>
              </div>
            </dl>
          )}
          <Link href="/checkout" className="btn-primary w-full mt-4">Continue to checkout</Link>
        </div>
      </aside>
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
