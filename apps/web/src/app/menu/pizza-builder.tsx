'use client';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiGet, apiPost } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';

interface Topping { _id: string; name: { en: string; ar?: string }; category: 'sauce' | 'cheese' | 'meat' | 'veg'; basePrice: number }

interface Product {
  id: string; name: { en: string; ar?: string };
  effectivePrice: number;
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { en: string }; priceDelta: number }>;
}

interface QuoteResponse {
  unitPrice: number;
  lineTotal: number;
}

export function PizzaBuilder({ product, onClose }: { product: Product; onClose: () => void }): JSX.Element {
  const cart = useCart();
  const [sizeCode, setSizeCode] = useState<'S' | 'M' | 'L' | 'XL'>(product.sizes?.[0]?.code ?? 'M');
  const [crustCode, setCrustCode] = useState<string>(product.crusts?.[0]?.code ?? '');
  const [sauceIds, setSauceIds] = useState<string[]>([]);
  const [toppingIds, setToppingIds] = useState<string[]>([]);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const [price, setPrice] = useState<number>(product.effectivePrice);

  const maxToppings = product.sizes?.find((s) => s.code === sizeCode)?.maxToppings ?? 5;

  useEffect(() => {
    apiGet<{ items: Topping[] }>('/catalog/toppings').then((r) => setToppings(r.items)).catch(() => undefined);
  }, []);

  // Live quote — debounced
  useEffect(() => {
    const t = setTimeout(() => {
      apiPost<QuoteResponse>('/catalog/products/price', {
        productId: product.id,
        branchId: cart.branchId,
        qty: 1,
        sizeCode, crustCode, toppingIds, sauceIds,
      })
        .then((r) => setPrice(r.unitPrice))
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [product.id, cart.branchId, sizeCode, crustCode, toppingIds, sauceIds]);

  function toggleArr(arr: string[], v: string): string[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function add(): void {
    cart.add({
      productId: product.id,
      productName: product.name.en,
      qty: 1,
      sizeCode, crustCode,
      sauceIds, toppingIds,
      estimatedUnitPrice: price,
    });
    onClose();
  }

  const sauces = toppings.filter((t) => t.category === 'sauce');
  const cheeses = toppings.filter((t) => t.category === 'cheese');
  const meats = toppings.filter((t) => t.category === 'meat');
  const veg = toppings.filter((t) => t.category === 'veg');

  return (
    <div className="fixed inset-0 z-30 bg-black/50 grid place-items-center p-4 overflow-y-auto">
      <div className="card w-full max-w-2xl my-8">
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-xl">{product.name.en}</h2>
            <p className="text-xs text-slate-500">Build your pizza</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-slate-100 rounded-md"><X className="h-5 w-5" /></button>
        </header>

        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Size */}
          {product.sizes && product.sizes.length > 0 && (
            <Section title="Size">
              <div className="flex gap-2 flex-wrap">
                {product.sizes.map((s) => (
                  <button key={s.code} onClick={() => setSizeCode(s.code)}
                          className={pillCls(sizeCode === s.code)}>
                    {s.code} <span className="text-xs text-slate-500">+{fmtSAR(s.priceDelta)}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Crust */}
          {product.crusts && product.crusts.length > 0 && (
            <Section title="Crust">
              <div className="flex gap-2 flex-wrap">
                {product.crusts.map((c) => (
                  <button key={c.code} onClick={() => setCrustCode(c.code)}
                          className={pillCls(crustCode === c.code)}>
                    {c.name.en} {c.priceDelta > 0 && <span className="text-xs text-slate-500">+{fmtSAR(c.priceDelta)}</span>}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* Sauces (single or multi) */}
          {sauces.length > 0 && (
            <Section title="Sauce">
              <ToggleGrid items={sauces} selected={sauceIds} onToggle={(id) => setSauceIds(toggleArr(sauceIds, id))} />
            </Section>
          )}

          {/* Toppings */}
          <Section title={`Toppings (max ${maxToppings})`}>
            <p className="text-xs text-slate-500 mb-2">Selected {toppingIds.length} / {maxToppings}</p>
            {[['Meats', meats], ['Cheeses', cheeses], ['Veggies', veg]].map(([label, list]) => (
              <div key={label as string} className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">{label as string}</div>
                <ToggleGrid items={list as Topping[]} selected={toppingIds}
                            disabledIf={(id) => !toppingIds.includes(id) && toppingIds.length >= maxToppings}
                            onToggle={(id) => setToppingIds(toggleArr(toppingIds, id))} />
              </div>
            ))}
          </Section>
        </div>

        <footer className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-2xl font-bold">{fmtSAR(price)}</div>
          <button className="btn-primary px-6 py-2.5" onClick={add}>Add to cart</button>
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function pillCls(active: boolean): string {
  return `px-4 py-2 rounded-full text-sm border transition ${
    active ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-slate-700 border-slate-300 hover:border-brand-400'
  }`;
}

function ToggleGrid({ items, selected, onToggle, disabledIf }: { items: Topping[]; selected: string[]; onToggle: (id: string) => void; disabledIf?: (id: string) => boolean }): JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((t) => {
        const active = selected.includes(t._id);
        const disabled = disabledIf?.(t._id) ?? false;
        return (
          <button
            key={t._id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(t._id)}
            className={`text-left px-3 py-2 rounded-md border text-sm transition ${
              active ? 'bg-brand-50 border-brand-500 text-brand-900' :
              disabled ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' :
                         'bg-white border-slate-300 hover:border-brand-400'
            }`}
          >
            <div className="font-medium">{t.name.en}</div>
            <div className="text-xs text-slate-500">{t.basePrice > 0 ? `+${fmtSAR(t.basePrice)}` : 'free'}</div>
          </button>
        );
      })}
    </div>
  );
}
