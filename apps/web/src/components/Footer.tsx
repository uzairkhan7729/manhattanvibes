import { ChefHat, Facebook, Instagram, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';

export function Footer(): JSX.Element {
  return (
    <footer className="bg-ink-900 text-stone-200 mt-24">
      <div className="container-x py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-brand-gradient grid place-items-center shadow-glow">
                <ChefHat className="h-5 w-5 text-white" />
              </div>
              <div className="leading-tight">
                <div className="font-extrabold text-white tracking-tight">Manhattan Vibes</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-brand-400 font-semibold">Pizza · Burgers · More</div>
              </div>
            </div>
            <p className="text-sm text-stone-400 mt-4 leading-relaxed">
              Hand-tossed pizza, flame-grilled burgers, and uncompromising ingredients — served fresh across Saudi Arabia.
            </p>
            <div className="flex gap-3 mt-5">
              <a className="h-10 w-10 grid place-items-center rounded-full bg-stone-800 hover:bg-brand-600 transition" aria-label="Instagram" href="#"><Instagram className="h-4 w-4" /></a>
              <a className="h-10 w-10 grid place-items-center rounded-full bg-stone-800 hover:bg-brand-600 transition" aria-label="Facebook"  href="#"><Facebook className="h-4 w-4" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Order</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li><Link href="/menu" className="hover:text-white transition">Menu</Link></li>
              <li><Link href="/menu" className="hover:text-white transition">Pizza builder</Link></li>
              <li><Link href="/cart" className="hover:text-white transition">Cart</Link></li>
              <li><Link href="/track" className="hover:text-white transition">Track order</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li><a className="hover:text-white transition" href="#">About</a></li>
              <li><a className="hover:text-white transition" href="#">Careers</a></li>
              <li><a className="hover:text-white transition" href="#">Press</a></li>
              <li><a className="hover:text-white transition" href="#">Sustainability</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-3">Get in touch</h4>
            <ul className="space-y-2 text-sm text-stone-400">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-brand-400" /> 800 100 1234</li>
              <li className="flex items-center gap-2"><MapPin className="h-4 w-4 text-brand-400" /> Riyadh · Jeddah</li>
            </ul>
            <div className="mt-5 p-4 rounded-2xl bg-stone-800 border border-stone-700">
              <p className="text-xs text-stone-300">Open today</p>
              <p className="text-sm font-semibold text-white">11:00 — 02:00</p>
            </div>
          </div>
        </div>

        <div className="border-t border-stone-800 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <p>© {new Date().getFullYear()} Manhattan Vibes. Built by Codlight Technologies.</p>
          <div className="flex gap-4">
            <a className="hover:text-white" href="#">Privacy</a>
            <a className="hover:text-white" href="#">Terms</a>
            <a className="hover:text-white" href="#">VAT compliance</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
