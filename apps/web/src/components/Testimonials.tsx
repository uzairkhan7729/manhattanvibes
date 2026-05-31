'use client';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const items = [
  {
    name: 'Layla A.', city: 'Riyadh', rating: 5,
    text: 'Best pizza I have had in Riyadh — the cheese-stuffed crust is a religious experience. Delivery was 18 minutes.',
  },
  {
    name: 'Khalid M.', city: 'Jeddah', rating: 5,
    text: 'The double-stack burger is the real deal. Hot, juicy, never dry. Tracking on the app is shockingly accurate.',
  },
  {
    name: 'Sara H.', city: 'Riyadh', rating: 5,
    text: 'Family ordering night every Thursday. The veggie pizza is exceptional and the kids inhale the wings.',
  },
  {
    name: 'Mohammed O.', city: 'Jeddah', rating: 4,
    text: 'Loyalty points add up faster than I expected. Got a free dessert on my birthday with no hassle.',
  },
];

export function Testimonials(): JSX.Element {
  return (
    <section className="section bg-stone-50 border-y border-stone-100">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <span className="pill-brand">★ Real customers</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight text-ink-900">
            Loved across the kingdom
          </h2>
          <p className="mt-4 text-stone-500">
            Hundreds of 5-star reviews — every order goes through the same kitchen our regulars trust.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="surface p-6 shadow-card flex flex-col h-full"
            >
              <Quote className="h-7 w-7 text-brand-300" />
              <blockquote className="mt-3 text-ink-700 leading-relaxed text-[15px] flex-1">
                "{t.text}"
              </blockquote>
              <figcaption className="mt-5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-ink-900">{t.name}</div>
                  <div className="text-xs text-stone-500">{t.city}</div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < t.rating ? 'text-amber-400 fill-current' : 'text-stone-200'}`} />
                  ))}
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
