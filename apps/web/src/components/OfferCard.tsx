'use client';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface Props {
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
  image: string;
  tone?: 'brand' | 'dark' | 'light';
  index?: number;
}

const toneStyles = {
  brand: 'from-brand-600 to-brand-400 text-white',
  dark:  'from-ink-900 to-ink-700 text-white',
  light: 'from-amber-100 to-amber-50 text-ink-900',
} as const;

export function OfferCard({ title, subtitle, badge, href, image, tone = 'brand', index = 0 }: Props): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Link
        href={href}
        className={`group relative block overflow-hidden rounded-3xl bg-gradient-to-br ${toneStyles[tone]} shadow-card hover:shadow-glow transition-shadow`}
      >
        <div className="relative aspect-[16/9] md:aspect-[2/1]">
          <Image src={image} alt={title} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover mix-blend-overlay opacity-70 group-hover:scale-105 transition-transform duration-700" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-transparent" />
        </div>
        <div className="absolute inset-0 p-7 md:p-10 flex flex-col justify-end">
          {badge && (
            <span className="self-start pill bg-white/15 text-white backdrop-blur-md ring-1 ring-white/20 mb-3">{badge}</span>
          )}
          <h3 className="text-2xl md:text-3xl font-extrabold leading-tight max-w-md">{title}</h3>
          <p className="mt-2 text-sm md:text-base opacity-90 max-w-md">{subtitle}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
            Order now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
