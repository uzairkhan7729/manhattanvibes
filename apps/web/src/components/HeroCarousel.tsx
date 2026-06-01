'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Star, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { HERO_IMAGES } from '@/lib/images';

export function HeroCarousel(): JSX.Element {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % HERO_IMAGES.length), 6500);
    return () => clearInterval(t);
  }, []);

  const slide = HERO_IMAGES[idx]!;

  return (
    <section className="relative h-[88vh] min-h-[640px] -mt-20 overflow-hidden bg-ink-900">
      {/* Slide images */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          <Image
            src={slide.url}
            alt=""
            fill
            priority={idx === 0}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-hero-fade" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Floating "fresh" tag */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="absolute top-28 right-6 md:right-12 hidden md:block"
      >
        <div className="rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/20 px-4 py-2 text-white text-xs uppercase tracking-widest font-semibold">
          ★ Open · Hot &amp; Fresh
        </div>
      </motion.div>

      {/* Content */}
      <div className="relative h-full container-x flex items-end md:items-center pb-16 pt-40">
        <div className="max-w-2xl text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-6"
          >
            <span className="pill-glass">
              <Star className="h-3 w-3 fill-current" /> 4.8 · trusted by 250k+
            </span>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`text-${idx}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="hero-h1">
                {slide.headline}<br />
                <span className="text-brand-400">{slide.accent}</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-stone-200 max-w-xl leading-relaxed">
                {slide.sub}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={slide.ctaHref} className="btn-primary text-base px-7 py-3.5">
              {slide.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/track" className="btn-secondary text-base px-7 py-3.5 bg-white/10 text-white border-white/20 hover:bg-white/20 hover:text-white">
              Track order
            </Link>
          </div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4 text-white/90"
          >
            <Stat icon={Clock} label="Avg prep" value="<12 min" />
            <Stat icon={Truck} label="Free delivery" value=">Rs 2,000" />
            <Stat icon={Star} label="App store" value="4.9 ★" />
          </motion.dl>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {HERO_IMAGES.map((_, i) => (
          <button
            key={i}
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-10 bg-brand-400' : 'w-2 bg-white/40'}`}
          />
        ))}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl bg-white/10 ring-1 ring-white/20 grid place-items-center">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <dt className="text-xs text-white/60 uppercase tracking-wide">{label}</dt>
        <dd className="text-base font-bold">{value}</dd>
      </div>
    </div>
  );
}
