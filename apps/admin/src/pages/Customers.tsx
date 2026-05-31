import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../lib/api';
import { fmtDate } from '../lib/format';

interface Customer {
  _id: string;
  fullName: { en: string; ar?: string };
  phone: { countryCode: string; number: string };
  email?: string;
  preferredLanguage: 'ar' | 'en';
  phoneVerified: boolean;
  emailVerified: boolean;
  status: string;
  createdAt: string;
  loyaltyAccountId?: string;
}

export function CustomersPage(): JSX.Element {
  const [search, setSearch] = useState('');
  const customers = useQuery({
    queryKey: ['customers', search],
    queryFn: () => api.get<{ items: Customer[] }>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-slate-500">Search by name, phone, or email.</p>
        </div>
        <input className="input w-72" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left">
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Lang</th>
              <th className="px-4 py-3 font-semibold">Verified</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>}
            {customers.data?.items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No customers</td></tr>}
            {customers.data?.items.map((c) => (
              <tr key={c._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{c.fullName?.en}</td>
                <td className="px-4 py-3"><code>{c.phone.countryCode}{c.phone.number}</code></td>
                <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                <td className="px-4 py-3 uppercase text-xs">{c.preferredLanguage}</td>
                <td className="px-4 py-3 text-xs space-x-1">
                  {c.phoneVerified && <span className="badge bg-emerald-100 text-emerald-700">phone</span>}
                  {c.emailVerified && <span className="badge bg-blue-100 text-blue-700">email</span>}
                </td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(c.createdAt, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
