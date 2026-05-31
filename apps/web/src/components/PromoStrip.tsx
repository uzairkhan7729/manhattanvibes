'use client';
import { Flame, Gift, Truck, Tag } from 'lucide-react';

const items = [
  { icon: Flame, text: '50% OFF on your 1st app order' },
  { icon: Truck, text: 'FREE delivery over 75 SAR' },
  { icon: Gift,  text: 'Earn loyalty points on every order' },
  { icon: Tag,   text: 'Family deals from 79 SAR' },
];

export function PromoStrip(): JSX.Element {
  // Duplicate the array for the marquee loop seamlessness.
  const loop = [...items, ...items];
  return (
    <div className="bg-ink-900 text-white overflow-hidden border-y border-stone-800">
      <div className="marquee py-3">
        {loop.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-medium">
            <it.icon className="h-4 w-4 text-brand-400" />
            <span>{it.text}</span>
            <span className="mx-6 text-stone-600">•</span>
          </div>
        ))}
      </div>
    </div>
  );
}
