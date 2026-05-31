'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ChefHat, Menu as MenuIcon, ShoppingBag, User, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from '@/lib/cart-store';

const nav = [
  { href: '/menu',    label: 'Menu' },
  { href: '/track',   label: 'Track order' },
  { href: '/account', label: 'Account' },
];

export function Header(): JSX.Element {
  const lines = useCart((s) => s.lines);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [path]);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-md border-b border-stone-200/80 shadow-sm'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="container-x h-16 md:h-20 flex items-center justify-between">
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-brand-gradient blur-md opacity-30 group-hover:opacity-50 transition" />
            <div className="relative h-9 w-9 rounded-xl bg-brand-gradient grid place-items-center shadow-glow">
              <ChefHat className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="leading-tight">
            <div className="font-extrabold text-ink-900 tracking-tight">Manhattan Vibes</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-brand-600 font-semibold">Pizza · Burgers · More</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`relative px-4 py-2 text-sm font-medium rounded-full transition ${
                path?.startsWith(n.href)
                  ? 'text-brand-700 bg-brand-50'
                  : 'text-ink-700 hover:text-brand-700 hover:bg-stone-100'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/account" aria-label="Account" className="hidden md:inline-flex btn-ghost rounded-full p-2">
            <User className="h-5 w-5" />
          </Link>
          <Link href="/cart" className="btn-primary relative">
            <ShoppingBag className="h-4 w-4" />
            <span>Cart</span>
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white text-brand-600 text-xs font-bold"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          <button
            className="md:hidden btn-ghost rounded-full p-2"
            aria-label="Open menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-stone-200 bg-white"
          >
            <div className="container-x py-4 space-y-1">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="block px-4 py-3 rounded-xl text-base font-medium hover:bg-stone-50"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
