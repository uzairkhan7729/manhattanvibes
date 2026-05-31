'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { ProductCard, type ProductLike } from '@/components/ProductCard';

interface Props {
  products: ProductLike[];
}

const FEATURED_SKUS = [
  'PIZ-MV-CLASSIC',
  'BUR-MV-DOUBLE',
  'PIZ-MV-VEGGIE',
  'SID-WINGS',
];

export function Featured({ products }: Props): JSX.Element {
  const featured = FEATURED_SKUS
    .map((sku) => products.find((p) => p.sku === sku))
    .filter((p): p is ProductLike => Boolean(p));

  if (featured.length === 0) return <></>;

  return (
    <section className="section bg-stone-50/50 border-y border-stone-100">
      <div className="container-x">
        <div className="flex items-end justify-between mb-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="pill-brand">Best sellers</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">Most loved this week</h2>
            <p className="text-stone-500 mt-3 max-w-md">
              Our top-ordered items across every branch — chosen by you.
            </p>
          </motion.div>
          <Link href="/menu" className="hidden md:inline-flex btn-secondary">
            View full menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featured.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              badge={i === 0 ? 'best' : i === 1 ? 'hot' : i === 2 ? 'new' : 'deal'}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
