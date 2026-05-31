import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { api, ApiError } from '../lib/api';
import { fmtSAR } from '../lib/format';

interface Category { _id: string; name: { en: string; ar?: string }; slug: string }
interface Product { id: string; sku: string; name: { en: string; ar?: string }; effectivePrice: number; isAvailable: boolean; type: string; categoryId: string; isVeg?: boolean; spicyLevel?: number }

export function ProductsPage(): JSX.Element {
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/catalog/categories') });
  const products = useQuery({ queryKey: ['products-all'], queryFn: () => api.get<{ items: Product[] }>('/catalog/products?limit=500') });
  const [showNew, setShowNew] = useState(false);

  const byCat = new Map<string, Product[]>();
  for (const p of products.data?.items ?? []) {
    const arr = byCat.get(p.categoryId) ?? [];
    arr.push(p);
    byCat.set(p.categoryId, arr);
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">All branches — base catalog. Use branch overrides for per-branch pricing.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4" /> New product
        </button>
      </header>

      {cats.data?.items.map((c) => (
        <section key={c._id} className="card">
          <h2 className="px-5 py-3 border-b border-slate-200 font-semibold">
            {c.name.en} <span className="text-xs text-slate-500 font-normal">{c.slug}</span>
          </h2>
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

      {showNew && cats.data && (
        <NewProductModal
          categories={cats.data.items}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

interface NewProductForm {
  sku: string;
  categoryId: string;
  nameEn: string;
  nameAr: string;
  type: 'simple' | 'configurable' | 'combo';
  basePrice: string;        // SAR (UI), converted to halalas on submit
  isVeg: boolean;
  spicyLevel: 0 | 1 | 2 | 3;
  isActive: boolean;
}

function NewProductModal({ categories, onClose }: { categories: Category[]; onClose: () => void }): JSX.Element {
  const qc = useQueryClient();
  const [f, setF] = useState<NewProductForm>({
    sku: '',
    categoryId: categories[0]?._id ?? '',
    nameEn: '',
    nameAr: '',
    type: 'simple',
    basePrice: '',
    isVeg: false,
    spicyLevel: 0,
    isActive: true,
  });

  const create = useMutation({
    mutationFn: () => api.post('/catalog/products', {
      sku: f.sku.trim(),
      categoryId: f.categoryId,
      name: { en: f.nameEn.trim(), ...(f.nameAr.trim() ? { ar: f.nameAr.trim() } : {}) },
      type: f.type,
      basePrice: Math.round(parseFloat(f.basePrice) * 100),    // SAR -> halalas
      isVeg: f.isVeg,
      spicyLevel: f.spicyLevel,
      isActive: f.isActive,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products-all'] });
      onClose();
    },
  });

  const errMsg = create.isError
    ? (create.error instanceof ApiError
        ? `${create.error.message}${create.error.fields ? ` (${Object.entries(create.error.fields).map(([k, v]) => `${k}: ${v}`).join(', ')})` : ''}`
        : 'Failed to create')
    : null;

  function disabled(): boolean {
    return !f.sku.trim() || !f.nameEn.trim() || !f.categoryId || !f.basePrice || isNaN(parseFloat(f.basePrice));
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold">New product</h2>
            <p className="text-xs text-slate-500">Added to the base catalog across all branches.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          className="p-5 space-y-3"
          onSubmit={(e) => { e.preventDefault(); if (!disabled()) create.mutate(); }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU *">
              <input
                className="input"
                value={f.sku}
                onChange={(e) => setF({ ...f, sku: e.target.value })}
                placeholder="PIZ-MV-NEW"
                autoFocus
              />
            </Field>
            <Field label="Category *">
              <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name.en}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (English) *">
              <input className="input" value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} placeholder="Margherita Pizza" />
            </Field>
            <Field label="Name (Arabic)">
              <input className="input" value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })} placeholder="بيتزا مارجريتا" dir="rtl" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *">
              <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as NewProductForm['type'] })}>
                <option value="simple">Simple</option>
                <option value="configurable">Configurable (pizza w/ sizes &amp; toppings)</option>
                <option value="combo">Combo</option>
              </select>
            </Field>
            <Field label="Base price (SAR) *">
              <input className="input" type="number" step="0.01" min="0" value={f.basePrice}
                     onChange={(e) => setF({ ...f, basePrice: e.target.value })} placeholder="29.50" />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Spicy level">
              <select className="input" value={f.spicyLevel}
                      onChange={(e) => setF({ ...f, spicyLevel: Number(e.target.value) as NewProductForm['spicyLevel'] })}>
                <option value={0}>None</option>
                <option value={1}>1 — Mild</option>
                <option value={2}>2 — Medium</option>
                <option value={3}>3 — Hot</option>
              </select>
            </Field>
            <Field label="Veg">
              <label className="inline-flex items-center gap-2 mt-2">
                <input type="checkbox" checked={f.isVeg} onChange={(e) => setF({ ...f, isVeg: e.target.checked })} />
                <span className="text-sm">Vegetarian</span>
              </label>
            </Field>
            <Field label="Active">
              <label className="inline-flex items-center gap-2 mt-2">
                <input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
                <span className="text-sm">Show in menu</span>
              </label>
            </Field>
          </div>

          {f.type === 'configurable' && (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-xs text-amber-800 px-3 py-2">
              Configurable products need sizes, crusts and topping lists. Create the product first, then add them via the API or a future "Edit product" screen.
            </div>
          )}

          {errMsg && (
            <div className="rounded-md border border-red-200 bg-red-50 text-sm text-red-700 px-3 py-2">{errMsg}</div>
          )}

          <footer className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={disabled() || create.isPending}>
              {create.isPending ? 'Creating…' : 'Create product'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
