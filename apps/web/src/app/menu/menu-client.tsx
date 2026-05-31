'use client';
import { Flame, Leaf, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';

import { PizzaBuilder } from './pizza-builder';

interface Category { _id: string; name: { en: string; ar?: string }; slug: string }
interface Product {
  id: string; sku: string; name: { en: string; ar?: string };
  effectivePrice: number; isAvailable: boolean; type: 'simple' | 'configurable' | 'combo';
  categoryId: string; isVeg?: boolean; spicyLevel?: number;
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { en: string }; priceDelta: number }>;
}
interface Branch { _id: string; code: string; name: { en: string } }

export function MenuClient({ categories, products, branches }: { categories: Category[]; products: Product[]; branches: Branch[] }): JSX.Element {
  const cart = useCart();
  const [activeCat, setActiveCat] = useState<string>(categories[0]?._id ?? '');
  const [builderProduct, setBuilderProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!cart.branchId && branches[0]) cart.setBranch(branches[0]._id);
  }, [cart, branches]);

  const productsByCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      const arr = m.get(p.categoryId) ?? [];
      arr.push(p);
      m.set(p.categoryId, arr);
    }
    return m;
  }, [products]);

  function addSimple(p: Product): void {
    cart.add({
      productId: p.id, productName: p.name.en, qty: 1,
      estimatedUnitPrice: p.effectivePrice,
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Menu</h1>
          <p className="text-sm text-slate-500">Prices include 15% VAT.</p>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Branch</label>
          <select className="input w-56" value={cart.branchId ?? ''} onChange={(e) => cart.setBranch(e.target.value)}>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name.en}</option>)}
          </select>
        </div>
      </header>

      {/* Category tabs */}
      <div className="sticky top-16 z-10 bg-slate-50/80 backdrop-blur border-b border-slate-200 -mx-4 px-4 mb-6 overflow-x-auto">
        <div className="flex gap-1">
          {categories.map((c) => (
            <button
              key={c._id}
              onClick={() => { setActiveCat(c._id); document.getElementById(`cat-${c._id}`)?.scrollIntoView({ behavior: 'smooth' }); }}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeCat === c._id ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {c.name.en}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="space-y-10">
        {categories.map((c) => {
          const items = productsByCat.get(c._id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={c._id} id={`cat-${c._id}`}>
              <h2 className="text-2xl font-bold mb-3">{c.name.en}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((p) => (
                  <article key={p.id} className="card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{p.name.en}</h3>
                        <p className="text-xs text-slate-500 capitalize">{p.type}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {p.isVeg && <Leaf className="h-4 w-4 text-emerald-500" />}
                        {p.spicyLevel && p.spicyLevel > 0 ? <Flame className="h-4 w-4 text-rose-500" /> : null}
                      </div>
                    </div>
                    <div className="flex items-end justify-between mt-auto">
                      <div className="font-bold text-lg">{fmtSAR(p.effectivePrice)}</div>
                      {p.type === 'configurable' ? (
                        <button className="btn-primary" onClick={() => setBuilderProduct(p)}>Customize</button>
                      ) : (
                        <button className="btn-primary" disabled={!p.isAvailable} onClick={() => addSimple(p)}>
                          <Plus className="h-4 w-4" /> Add
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {builderProduct && (
        <PizzaBuilder product={builderProduct} onClose={() => setBuilderProduct(null)} />
      )}
    </div>
  );
}
