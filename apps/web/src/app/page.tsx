import { Award, Clock, Leaf, Salad, ShieldCheck, Star } from 'lucide-react';
import Link from 'next/link';

import { Featured } from './_home/featured';
import { Locations } from './_home/locations';
import { HeroCarousel } from '@/components/HeroCarousel';
import { OfferCard } from '@/components/OfferCard';
import { PromoStrip } from '@/components/PromoStrip';
import { Testimonials } from '@/components/Testimonials';
import { apiGet } from '@/lib/api';
import { HERO_IMAGES, LIFESTYLE } from '@/lib/images';

interface Branch { _id: string; code: string; name: { en: string; ar?: string }; address: { city: string; district: string }; status: string }
interface Category { _id: string; name: { en: string; ar?: string }; slug: string; displayOrder: number }
interface Product {
  id: string; sku: string; name: { en: string; ar?: string };
  effectivePrice: number; isAvailable: boolean; type: 'simple' | 'configurable' | 'combo';
  categoryId: string; isVeg?: boolean; spicyLevel?: number;
}

export default async function HomePage(): Promise<JSX.Element> {
  const [branches, cats, products] = await Promise.all([
    apiGet<{ items: Branch[] }>('/branches').catch(() => ({ items: [] as Branch[] })),
    apiGet<{ items: Category[] }>('/catalog/categories').catch(() => ({ items: [] as Category[] })),
    apiGet<{ items: Product[] }>('/catalog/products?limit=500').catch(() => ({ items: [] as Product[] })),
  ]);

  const slugByCat = new Map(cats.items.map((c) => [c._id, c.slug]));
  const productsWithSlug = products.items.map((p) => ({ ...p, categorySlug: slugByCat.get(p.categoryId) }));

  return (
    <>
      <HeroCarousel />
      <PromoStrip />

      {/* Category pills */}
      <section className="section pb-0">
        <div className="container-x">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            What are you <span className="accent-underline">craving</span>?
          </h2>
          <p className="text-stone-500 mt-3 max-w-md">
            Pick a category — or hit the menu to see everything in one place.
          </p>

          <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {cats.items
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((c) => (
                <Link
                  key={c._id}
                  href={`/menu#cat-${c._id}`}
                  className="group surface p-4 text-center hover:border-brand-300 hover:shadow-glow transition-all"
                >
                  <div className="text-3xl mb-2">{EMOJI[c.slug] ?? '🍽️'}</div>
                  <div className="text-sm font-semibold text-ink-900 group-hover:text-brand-700 transition">{c.name.en}</div>
                </Link>
              ))}
          </div>
        </div>
      </section>

      {/* Special offers */}
      <section className="section">
        <div className="container-x">
          <div className="flex items-end justify-between mb-8">
            <div>
              <span className="pill-brand">Today only</span>
              <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">Special offers</h2>
            </div>
            <Link href="/menu" className="hidden md:inline-flex btn-secondary">See all</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <OfferCard
              tone="brand"
              badge="50% OFF"
              title="First app order, half price"
              subtitle="New customers — your first order through the app is 50% off, up to Rs 800. Auto-applied."
              href="/menu"
              image={HERO_IMAGES[0]!.url}
              index={0}
            />
            <OfferCard
              tone="dark"
              badge="Family feast"
              title="2 Large pizzas + sides — Rs 2,400"
              subtitle="Two large hand-tossed pizzas, fries and 4 drinks. Perfect for the whole table."
              href="/menu"
              image={HERO_IMAGES[1]!.url}
              index={1}
            />
          </div>
        </div>
      </section>

      <Featured products={productsWithSlug} />

      {/* Why us strip */}
      <section className="section bg-ink-900 text-white">
        <div className="container-x grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="pill-glass">Why Manhattan Vibes</span>
            <h2 className="hero-h1 mt-4 text-white">
              Real ingredients.<br /><span className="text-brand-400">Real fire. Real fast.</span>
            </h2>
            <ul className="mt-8 space-y-4 text-stone-200">
              <Why icon={Award}       title="Award-winning recipes"  body="Italian-trained pizzaiolos. Tested every week, refined every season." />
              <Why icon={Leaf}        title="Sourced locally"        body="Vegetables from KSA farms, meat from approved halal suppliers." />
              <Why icon={ShieldCheck} title="SFDA + ZATCA compliant" body="Full nutrition labels, e-invoicing, the whole hospitality stack." />
              <Why icon={Clock}       title="Ready in minutes"       body="Most orders out the kitchen door in under 12 minutes." />
            </ul>
          </div>
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-glow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LIFESTYLE.kitchen} alt="Inside the Manhattan Vibes kitchen" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-white/10 backdrop-blur-md p-5 ring-1 ring-white/20">
              <div className="flex items-center gap-2 text-amber-300">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                "Best pizza I've had in the kingdom. Hand-tossed, properly charred, real cheese."
              </p>
              <p className="mt-2 text-xs uppercase tracking-widest text-white/70">— Vogue Arabia review</p>
            </div>
          </div>
        </div>
      </section>

      <Testimonials />
      <Locations branches={branches.items} />

      {/* Final CTA */}
      <section className="section">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-3xl bg-brand-gradient text-white p-10 md:p-16 shadow-glow">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10" />
            <div className="absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-white/10" />
            <div className="relative max-w-2xl">
              <Salad className="h-10 w-10 mb-4 opacity-90" />
              <h2 className="hero-h1 text-white">Hungry already?</h2>
              <p className="mt-5 text-lg text-white/90 max-w-lg">
                The menu is loaded. The kitchen is hot. Your first order is a tap away.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/menu" className="btn bg-white text-brand-700 hover:bg-stone-100 px-7 py-3.5 text-base">
                  Browse the menu
                </Link>
                <Link href="/track" className="btn bg-white/15 text-white border border-white/30 hover:bg-white/25 px-7 py-3.5 text-base">
                  Track an order
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const EMOJI: Record<string, string> = {
  pizza: '🍕', burgers: '🍔', salads: '🥗', sides: '🍟', drinks: '🥤', desserts: '🍰',
};

function Why({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }): JSX.Element {
  return (
    <li className="flex items-start gap-4">
      <div className="h-12 w-12 rounded-2xl bg-brand-500/15 ring-1 ring-brand-500/30 grid place-items-center shrink-0">
        <Icon className="h-5 w-5 text-brand-300" />
      </div>
      <div>
        <h4 className="font-bold text-white">{title}</h4>
        <p className="text-sm text-stone-300 leading-relaxed mt-0.5">{body}</p>
      </div>
    </li>
  );
}
