'use client';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import { ProductCard, type ProductLike } from '@/components/ProductCard';
import { useCart } from '@/lib/cart-store';
import { CATEGORY_IMAGES } from '@/lib/images';

import { PizzaBuilder } from './pizza-builder';

interface Category { _id: string; name: { en: string; ar?: string }; slug: string; displayOrder?: number }
interface Product extends ProductLike {
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

  // Highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible) {
          const id = visible.target.id.replace('cat-', '');
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: '-30% 0px -55% 0px' },
    );
    categories.forEach((c) => {
      const el = document.getElementById(`cat-${c._id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories]);

  const productsBySlug = useMemo(() => new Map(categories.map((c) => [c._id, c.slug])), [categories]);
  const productsByCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) {
      const arr = m.get(p.categoryId) ?? [];
      arr.push({ ...p, categorySlug: productsBySlug.get(p.categoryId) });
      m.set(p.categoryId, arr);
    }
    return m;
  }, [products, productsBySlug]);

  return (
    <>
      {/* Menu hero — small banner */}
      <section className="relative h-[36vh] min-h-[280px] -mt-20 overflow-hidden bg-ink-900">
        <Image
          src={CATEGORY_IMAGES.pizza!}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/40 via-ink-900/40 to-ink-900/95" />
        <div className="relative h-full container-x flex flex-col justify-end pb-10 pt-32 text-white">
          <span className="pill-glass w-fit">Our menu</span>
          <h1 className="hero-h1 mt-3">
            Pick your <span className="text-brand-400">favorite</span>
          </h1>
          <p className="mt-3 text-stone-200 max-w-xl">Prices include 15% VAT. Branch may affect pricing & availability.</p>
        </div>
      </section>

      <div className="container-x pb-24 -mt-8 relative z-10">
        {/* Branch selector card */}
        <div className="surface p-4 md:p-5 shadow-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-100 text-brand-600 grid place-items-center">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-stone-500 font-semibold">Ordering from</div>
              <div className="font-semibold">{branches.find((b) => b._id === cart.branchId)?.name.en ?? 'Pick a branch'}</div>
            </div>
          </div>
          <select className="input max-w-xs" value={cart.branchId ?? ''} onChange={(e) => cart.setBranch(e.target.value)}>
            {branches.map((b) => <option key={b._id} value={b._id}>{b.name.en} ({b.code})</option>)}
          </select>
        </div>

        {/* Sticky category tabs */}
        <div className="sticky top-20 z-20 mt-6 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="surface px-2 py-2 shadow-card overflow-x-auto no-scrollbar">
            <div className="flex gap-1 min-w-max">
              {categories.map((c) => (
                <button
                  key={c._id}
                  onClick={() => document.getElementById(`cat-${c._id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`relative px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                    activeCat === c._id ? 'bg-brand-500 text-white shadow-glow' : 'text-ink-700 hover:bg-stone-100'
                  }`}
                >
                  {c.name.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category sections */}
        <div className="mt-10 space-y-16">
          {categories.map((c, ci) => {
            const items = productsByCat.get(c._id) ?? [];
            if (items.length === 0) return null;
            return (
              <section key={c._id} id={`cat-${c._id}`} className="scroll-mt-40">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="flex items-end justify-between mb-6"
                >
                  <div>
                    <span className="pill-brand">{ci === 0 ? 'Signature' : 'Menu'}</span>
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-2">{c.name.en}</h2>
                  </div>
                  <span className="text-sm text-stone-500">{items.length} items</span>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {items.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onCustomize={(prod) => setBuilderProduct(prod as Product)}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {builderProduct && (
        <PizzaBuilder product={builderProduct} onClose={() => setBuilderProduct(null)} />
      )}
    </>
  );
}
