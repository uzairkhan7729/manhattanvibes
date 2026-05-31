'use client';
import { motion } from 'framer-motion';
import { Clock, MapPin, Navigation, Phone } from 'lucide-react';

interface Branch { _id: string; code: string; name: { en: string; ar?: string }; address: { city: string; district: string }; status: string }

export function Locations({ branches }: { branches: Branch[] }): JSX.Element {
  if (branches.length === 0) return <></>;
  return (
    <section className="section">
      <div className="container-x">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="pill-brand">Find us</span>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mt-3">Our locations</h2>
          <p className="text-stone-500 mt-3">
            {branches.length} branches across the Kingdom — and counting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b, i) => (
            <motion.div
              key={b._id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="surface p-6 shadow-card hover:shadow-glow transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-12 w-12 rounded-2xl bg-brand-100 grid place-items-center text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition">
                  <MapPin className="h-5 w-5" />
                </div>
                <span className="pill bg-emerald-100 text-emerald-700">{b.status}</span>
              </div>
              <div className="text-xs uppercase tracking-widest text-brand-600 font-bold">{b.code}</div>
              <h3 className="text-xl font-bold text-ink-900 mt-1">{b.name.en}</h3>
              <p className="text-sm text-stone-500 mt-2">{b.address.district}, {b.address.city}</p>
              <div className="mt-5 flex items-center gap-4 text-xs text-stone-500">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> 11:00–02:00</span>
                <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> 800 100 1234</span>
              </div>
              <button className="mt-5 w-full btn-secondary group-hover:border-brand-300">
                <Navigation className="h-4 w-4" /> Get directions
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
