'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { apiGet, apiPost } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';
import { productImage } from '@/lib/images';

interface Topping { _id: string; name: { en: string; ar?: string }; category: 'sauce' | 'cheese' | 'meat' | 'veg'; basePrice: number }

interface Product {
  id: string;
  sku?: string;
  name: { en: string; ar?: string };
  effectivePrice: number;
  categorySlug?: string;
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { en: string }; priceDelta: number }>;
}

interface QuoteResponse { unitPrice: number; lineTotal: number }

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
    // Lock body scroll while modal open
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

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
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-2 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          key="sheet"
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="surface w-full max-w-4xl my-4 grid md:grid-cols-[42%_1fr] overflow-hidden shadow-glow"
        >
          {/* Hero image */}
          <div className="relative h-56 md:h-auto bg-stone-100">
            <Image
              src={productImage(product.sku, product.categorySlug)}
              alt={product.name.en}
              fill
              sizes="(min-width: 768px) 42vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0" />
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/90 backdrop-blur grid place-items-center text-ink-700 hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <span className="pill-glass">Build your own</span>
              <h2 className="font-extrabold text-3xl mt-2 drop-shadow">{product.name.en}</h2>
            </div>
          </div>

          {/* Builder */}
          <div className="flex flex-col max-h-[90vh] md:max-h-[80vh]">
            <div className="p-6 space-y-7 overflow-y-auto">
              {product.sizes && product.sizes.length > 0 && (
                <Section title="Size">
                  <div className="grid grid-cols-4 gap-2">
                    {product.sizes.map((s) => (
                      <button
                        key={s.code}
                        onClick={() => setSizeCode(s.code)}
                        className={tileCls(sizeCode === s.code)}
                      >
                        <span className="text-lg font-extrabold">{s.code}</span>
                        <span className="text-xs opacity-75 block">+{fmtSAR(s.priceDelta)}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {product.crusts && product.crusts.length > 0 && (
                <Section title="Crust">
                  <div className="flex gap-2 flex-wrap">
                    {product.crusts.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setCrustCode(c.code)}
                        className={pillCls(crustCode === c.code)}
                      >
                        {c.name.en} {c.priceDelta > 0 && <span className="text-xs opacity-75 ml-1">+{fmtSAR(c.priceDelta)}</span>}
                      </button>
                    ))}
                  </div>
                </Section>
              )}

              {sauces.length > 0 && (
                <Section title="Sauce">
                  <ToggleGrid items={sauces} selected={sauceIds} onToggle={(id) => setSauceIds(toggleArr(sauceIds, id))} />
                </Section>
              )}

              <Section title={`Toppings`} note={`${toppingIds.length} / ${maxToppings} selected`}>
                {[['Meats', meats], ['Cheeses', cheeses], ['Veggies', veg]].map(([label, list]) => (
                  <div key={label as string} className="mt-3">
                    <div className="text-xs font-semibold text-stone-500 mb-2 uppercase tracking-widest">{label as string}</div>
                    <ToggleGrid
                      items={list as Topping[]}
                      selected={toppingIds}
                      disabledIf={(id) => !toppingIds.includes(id) && toppingIds.length >= maxToppings}
                      onToggle={(id) => setToppingIds(toggleArr(toppingIds, id))}
                    />
                  </div>
                ))}
              </Section>
            </div>

            <footer className="px-6 py-4 border-t border-stone-200 flex items-center justify-between bg-stone-50">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">Total</div>
                <motion.div
                  key={price}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-extrabold text-ink-900"
                >
                  {fmtSAR(price)}
                </motion.div>
              </div>
              <button className="btn-primary px-6 py-3 text-base" onClick={add}>
                <ShoppingBag className="h-4 w-4" /> Add to cart
              </button>
            </footer>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-bold text-sm uppercase tracking-widest text-ink-700">{title}</h3>
        {note && <span className="text-xs text-stone-500">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function pillCls(active: boolean): string {
  return `px-4 py-2 rounded-full text-sm border transition ${
    active ? 'bg-brand-500 text-white border-brand-500 shadow-glow' : 'bg-white text-ink-700 border-stone-300 hover:border-brand-400'
  }`;
}

function tileCls(active: boolean): string {
  return `text-center px-3 py-3 rounded-2xl border transition ${
    active
      ? 'bg-brand-500 text-white border-brand-500 shadow-glow'
      : 'bg-white text-ink-700 border-stone-200 hover:border-brand-400 hover:shadow-card'
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
            className={`text-left px-3 py-2.5 rounded-xl border text-sm transition ${
              active
                ? 'bg-brand-50 border-brand-500 text-brand-900 ring-1 ring-brand-500/50'
                : disabled
                  ? 'bg-stone-50 border-stone-200 text-stone-400 cursor-not-allowed'
                  : 'bg-white border-stone-200 hover:border-brand-400'
            }`}
          >
            <div className="font-semibold">{t.name.en}</div>
            <div className="text-xs text-stone-500 mt-0.5">{t.basePrice > 0 ? `+${fmtSAR(t.basePrice)}` : 'included'}</div>
          </button>
        );
      })}
    </div>
  );
}
