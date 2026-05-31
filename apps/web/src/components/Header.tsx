'use client';
import { ChefHat, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';

import { useCart } from '@/lib/cart-store';

export function Header(): JSX.Element {
  const lines = useCart((s) => s.lines);
  const count = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <ChefHat className="h-7 w-7 text-brand-500" />
          <span className="font-extrabold text-lg">Manhattan Vibes</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/menu" className="btn-ghost">Menu</Link>
          <Link href="/track" className="btn-ghost hidden sm:inline-flex">Track order</Link>
          <Link href="/account" className="btn-ghost" aria-label="Account"><User className="h-4 w-4" /></Link>
          <Link href="/cart" className="btn-primary">
            <ShoppingCart className="h-4 w-4" />
            <span>Cart{count > 0 && ` (${count})`}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
