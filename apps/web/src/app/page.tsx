import { Clock, MapPin, Pizza, Tag } from 'lucide-react';
import Link from 'next/link';

import { apiGet } from '@/lib/api';

interface Branch { _id: string; code: string; name: { en: string; ar?: string }; address: { city: string; district: string }; status: string }

export default async function HomePage(): Promise<JSX.Element> {
  const branches = await apiGet<{ items: Branch[] }>('/branches').catch(() => ({ items: [] as Branch[] }));

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 to-orange-100 py-16">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
              Manhattan-style pizza, <br className="hidden md:inline" />
              <span className="text-brand-600">delivered hot.</span>
            </h1>
            <p className="text-lg text-slate-700 mt-4 max-w-md">
              Hand-tossed dough, real mozzarella, and toppings you'll fight over. Order online, pick up in-store, or sit down — we've got you.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/menu" className="btn-primary text-base px-6 py-3">Order now</Link>
              <Link href="/menu#pizza-builder" className="btn-ghost text-base px-6 py-3">Build your own</Link>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <Pizza className="w-72 h-72 text-brand-500" strokeWidth={1} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
        <Feature icon={Clock} title="Fast — guaranteed" desc="Most orders out the door in under 25 minutes." />
        <Feature icon={Tag} title="Loyalty rewards" desc="Earn points on every paid order, redeem at checkout." />
        <Feature icon={MapPin} title="Multiple locations" desc={`${branches.items.length} branches across KSA — and counting.`} />
      </section>

      {/* Locations */}
      {branches.items.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="text-2xl font-bold mb-6">Our locations</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {branches.items.map((b) => (
              <div key={b._id} className="card p-5">
                <div className="text-xs uppercase tracking-wide text-brand-600 font-semibold">{b.code}</div>
                <h3 className="font-bold mt-1">{b.name.en}</h3>
                <p className="text-sm text-slate-600">{b.address.district}, {b.address.city}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }): JSX.Element {
  return (
    <div className="card p-6">
      <Icon className="h-8 w-8 text-brand-500" />
      <h3 className="font-bold text-lg mt-3">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{desc}</p>
    </div>
  );
}
