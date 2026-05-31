import { Banknote, CreditCard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useSession } from '../lib/auth';
import { API_BASE } from '../lib/config';
import { fmtSAR, newClientOpId } from '../lib/format';

interface Category { _id: string; name: { en: string }; slug: string; displayOrder: number }
interface Product {
  id: string; sku: string; name: { en: string }; effectivePrice: number; type: string; categoryId: string; isAvailable: boolean;
}
interface CartLine { id: string; productId: string; name: string; qty: number; unitPrice: number; sizeCode?: string }

export function Sales(): JSX.Element {
  const session = useSession();
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [type, setType] = useState<'dinein' | 'takeaway' | 'delivery' | 'pickup'>('takeaway');
  const [paying, setPaying] = useState<null | 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay'>(null);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session.accessToken || !session.branchId) return;
    void (async () => {
      const [c, p] = await Promise.all([
        fetch(`${API_BASE}/api/v1/catalog/categories`, { headers: { authorization: `Bearer ${session.accessToken!}` } }).then((r) => r.json() as Promise<{ items: Category[] }>),
        fetch(`${API_BASE}/api/v1/catalog/products?branchId=${session.branchId}&limit=500`, { headers: { authorization: `Bearer ${session.accessToken!}` } }).then((r) => r.json() as Promise<{ items: Product[] }>),
      ]);
      const sorted = c.items.sort((a, b) => a.displayOrder - b.displayOrder);
      setCats(sorted);
      setProducts(p.items);
      setActiveCat(sorted[0]?._id ?? '');
    })();
  }, [session.accessToken, session.branchId]);

  const items = useMemo(() => products.filter((p) => p.categoryId === activeCat), [products, activeCat]);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);

  function add(p: Product): void {
    setCart((c) => {
      const idx = c.findIndex((l) => l.productId === p.id && !l.sizeCode);
      if (idx >= 0) {
        const cur = c[idx]!;
        const updated = [...c];
        updated[idx] = { ...cur, qty: cur.qty + 1 };
        return updated;
      }
      return [...c, { id: newClientOpId(), productId: p.id, name: p.name.en, qty: 1, unitPrice: p.effectivePrice }];
    });
  }
  function remove(lineId: string): void { setCart((c) => c.filter((l) => l.id !== lineId)); }
  function setQty(lineId: string, qty: number): void {
    setCart((c) => c.map((l) => l.id === lineId ? { ...l, qty: Math.max(1, qty) } : l));
  }

  async function pay(method: 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay'): Promise<void> {
    if (cart.length === 0) return;
    setPaying(method);
    setBusyMsg('Queueing order…');

    // 1) enqueue ORDER_CREATE to local outbox
    const orderClientOpId = newClientOpId();
    await window.mv.outbox.enqueue({
      clientOpId: orderClientOpId,
      ts: new Date().toISOString(),
      op: 'ORDER_CREATE',
      payload: {
        branchId: session.branchId,
        type,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
        clientOpId: orderClientOpId,
      },
    });

    setBusyMsg('Order saved locally — syncing…');
    // 2) attempt immediate drain so the user sees feedback when online
    const result = await window.mv.outbox.drain(API_BASE, session.accessToken!);
    setBusyMsg(`Drain: ${result.applied} applied · ${result.failed} failed · ${result.conflicts} conflicts`);

    // For cash payment we'd normally also enqueue a PAYMENT_CAPTURE op once the order has a canonical id.
    // Phase 1 sandbox: the server creates a placeholder; cashier reconciles via admin if needed.
    void method;
    setTimeout(() => {
      setCart([]);
      setPaying(null);
      setBusyMsg(null);
    }, 1200);
  }

  return (
    <div className="flex-1 grid grid-cols-[1fr_360px] overflow-hidden">
      {/* Menu */}
      <div className="flex flex-col overflow-hidden">
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex gap-1 overflow-x-auto">
          {cats.map((c) => (
            <button key={c._id} onClick={() => setActiveCat(c._id)}
                    className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${activeCat === c._id ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>
              {c.name.en}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start">
          {items.map((p) => (
            <button key={p.id} className="btn-tile" disabled={!p.isAvailable} onClick={() => add(p)}>
              <div className="font-medium text-sm">{p.name.en}</div>
              <div className="text-xs text-slate-500">{p.sku}</div>
              <div className="font-bold mt-1">{fmtSAR(p.effectivePrice)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cart */}
      <aside className="bg-white border-l border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h2 className="font-bold">Order</h2>
          <div className="flex gap-1">
            {(['dinein', 'takeaway', 'delivery', 'pickup'] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                      className={`px-2 py-1 rounded text-xs capitalize ${type === t ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {cart.length === 0 && <li className="p-6 text-sm text-slate-500 text-center">Tap items to add</li>}
          {cart.map((l) => (
            <li key={l.id} className="p-3 flex items-start gap-2">
              <div className="flex-1">
                <div className="font-medium text-sm">{l.name}</div>
                <div className="text-xs text-slate-500">{fmtSAR(l.unitPrice)} ea</div>
                <div className="mt-1 inline-flex items-center border border-slate-300 rounded-md text-xs">
                  <button onClick={() => setQty(l.id, l.qty - 1)} className="px-2 py-0.5 hover:bg-slate-100">−</button>
                  <span className="px-2">{l.qty}</span>
                  <button onClick={() => setQty(l.id, l.qty + 1)} className="px-2 py-0.5 hover:bg-slate-100">+</button>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">{fmtSAR(l.unitPrice * l.qty)}</div>
                <button onClick={() => remove(l.id)} className="mt-2 text-slate-400 hover:text-red-600" aria-label="remove"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="flex justify-between text-sm"><span>Subtotal</span><strong>{fmtSAR(subtotal)}</strong></div>
          {busyMsg && <div className="text-xs text-slate-500 italic">{busyMsg}</div>}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button className="btn-primary" disabled={cart.length === 0 || !!paying} onClick={() => void pay('cash')}>
              <Banknote className="h-4 w-4" /> Cash
            </button>
            <button className="btn-primary" disabled={cart.length === 0 || !!paying} onClick={() => void pay('mada')}>
              <CreditCard className="h-4 w-4" /> Card
            </button>
          </div>
          <button className="btn-ghost w-full" disabled={cart.length === 0} onClick={() => setCart([])}>
            <Plus className="h-4 w-4 rotate-45" /> Clear
          </button>
        </div>
      </aside>
    </div>
  );
}
