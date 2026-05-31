'use client';
import { motion } from 'framer-motion';
import { Flame, Leaf, Plus, Star } from 'lucide-react';
import Image from 'next/image';

import { useCart } from '@/lib/cart-store';
import { fmtSAR } from '@/lib/format';
import { productImage } from '@/lib/images';

export interface ProductLike {
  id: string;
  sku: string;
  name: { en: string; ar?: string };
  effectivePrice: number;
  isAvailable: boolean;
  type: 'simple' | 'configurable' | 'combo';
  categoryId: string;
  categorySlug?: string;
  isVeg?: boolean;
  spicyLevel?: number;
  description?: { en?: string; ar?: string };
}

interface Props {
  product: ProductLike;
  /** Optional badge tier — 'best' renders highlighted */
  badge?: 'best' | 'new' | 'hot' | 'deal';
  onCustomize?: (p: ProductLike) => void;
  index?: number;
}

const badgeStyles: Record<NonNullable<Props['badge']>, { label: string; cls: string }> = {
  best: { label: 'Best seller', cls: 'bg-amber-100 text-amber-700' },
  new:  { label: 'New',         cls: 'bg-emerald-100 text-emerald-700' },
  hot:  { label: 'Spicy',       cls: 'bg-rose-100 text-rose-700' },
  deal: { label: 'Deal',        cls: 'bg-brand-100 text-brand-700' },
};

export function ProductCard({ product, badge, onCustomize, index = 0 }: Props): JSX.Element {
  const cart = useCart();

  function addSimple(): void {
    cart.add({
      productId: product.id,
      productName: product.name.en,
      qty: 1,
      estimatedUnitPrice: product.effectivePrice,
    });
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay: (index % 8) * 0.05 }}
      whileHover={{ y: -6 }}
      className="group surface overflow-hidden flex flex-col shadow-card hover:shadow-glow transition-shadow"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
        <Image
          src={productImage(product.sku, product.categorySlug)}
          alt={product.name.en}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {badge && (
            <span className={`pill ${badgeStyles[badge].cls}`}>
              {badge === 'best' && <Star className="h-3 w-3 fill-current" />}
              {badgeStyles[badge].label}
            </span>
          )}
          {product.isVeg && (
            <span className="pill bg-white/90 backdrop-blur text-emerald-700">
              <Leaf className="h-3 w-3" /> Veg
            </span>
          )}
          {product.spicyLevel && product.spicyLevel > 0 ? (
            <span className="pill bg-white/90 backdrop-blur text-rose-600">
              <Flame className="h-3 w-3" /> Spicy
            </span>
          ) : null}
        </div>

        {/* Quick add (simple products) */}
        {product.type !== 'configurable' && (
          <button
            onClick={addSimple}
            disabled={!product.isAvailable}
            className="absolute bottom-3 right-3 h-11 w-11 rounded-full bg-white text-brand-600 grid place-items-center shadow-lg
                       opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300
                       hover:bg-brand-500 hover:text-white disabled:opacity-40"
            aria-label={`Add ${product.name.en}`}
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-ink-900 truncate">{product.name.en}</h3>
            {product.description?.en && (
              <p className="text-sm text-stone-500 line-clamp-2 mt-1">{product.description.en}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-lg font-extrabold text-ink-900">{fmtSAR(product.effectivePrice)}</div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">inc. VAT</div>
          </div>
        </div>

        <div className="mt-auto pt-2">
          {product.type === 'configurable' ? (
            <button onClick={() => onCustomize?.(product)} className="btn-primary w-full">
              Customize
            </button>
          ) : (
            <button onClick={addSimple} disabled={!product.isAvailable} className="btn-secondary w-full">
              <Plus className="h-4 w-4" /> Add to cart
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
