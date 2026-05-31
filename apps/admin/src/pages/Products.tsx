import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';
import { fmtSAR } from '../lib/format';

interface Category { _id: string; name: { en: string; ar?: string }; slug: string }
interface Product { id: string; sku: string; name: { en: string; ar?: string }; effectivePrice: number; isAvailable: boolean; type: string; categoryId: string; isVeg?: boolean; spicyLevel?: number }

export function ProductsPage(): JSX.Element {
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/catalog/categories') });
  const products = useQuery({ queryKey: ['products-all'], queryFn: () => api.get<{ items: Product[] }>('/catalog/products?limit=500') });

  const byCat = new Map<string, Product[]>();
  for (const p of products.data?.items ?? []) {
    const arr = byCat.get(p.categoryId) ?? [];
    arr.push(p);
    byCat.set(p.categoryId, arr);
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Products</h1>
        <p className="text-sm text-slate-500">All branches — base catalog. Use branch overrides for per-branch pricing.</p>
      </header>

      {cats.data?.items.map((c) => (
        <section key={c._id} className="card">
          <h2 className="px-5 py-3 border-b border-slate-200 font-semibold">{c.name.en} <span className="text-xs text-slate-500 font-normal">{c.slug}</span></h2>
          <ul>
            {(byCat.get(c._id) ?? []).map((p) => (
              <li key={p.id} className="px-5 py-3 border-b border-slate-100 last:border-0 flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.name.en}</div>
                  <div className="text-xs text-slate-500 space-x-2">
                    <code>{p.sku}</code>
                    <span>· {p.type}</span>
                    {p.isVeg && <span className="badge bg-emerald-100 text-emerald-700">veg</span>}
                    {p.spicyLevel && p.spicyLevel > 0 && <span className="badge bg-rose-100 text-rose-700">spicy {p.spicyLevel}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{fmtSAR(p.effectivePrice)}</div>
                  {!p.isAvailable && <div className="text-xs text-red-600">unavailable</div>}
                </div>
              </li>
            ))}
            {(byCat.get(c._id) ?? []).length === 0 && (
              <li className="px-5 py-6 text-sm text-slate-500 text-center">No products in this category</li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
