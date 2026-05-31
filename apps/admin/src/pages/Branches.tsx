import { useQuery } from '@tanstack/react-query';

import { api } from '../lib/api';

interface Branch {
  _id: string;
  code: string;
  name: { en: string; ar?: string };
  address: { line1: string; city: string; district: string; lat: number; lng: number };
  contact: { phone: string; email?: string };
  status: string;
  features: { dineIn?: boolean; pickup?: boolean; delivery?: boolean; takeaway?: boolean };
}

export function BranchesPage(): JSX.Element {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<{ items: Branch[] }>('/branches') });

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Branches</h1>
        <p className="text-sm text-slate-500">All locations across the network.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.data?.items.map((b) => (
          <div key={b._id} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-brand-600 font-semibold">{b.code}</div>
                <h3 className="text-lg font-bold mt-1">{b.name.en}</h3>
                <p className="text-sm text-slate-600 mt-2">{b.address.line1}, {b.address.district}, {b.address.city}</p>
                <p className="text-xs text-slate-500 mt-1">{b.address.lat.toFixed(4)}, {b.address.lng.toFixed(4)}</p>
              </div>
              <span className={`badge ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{b.status}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {b.features?.dineIn   && <span className="badge bg-blue-100 text-blue-700">dine-in</span>}
              {b.features?.takeaway && <span className="badge bg-blue-100 text-blue-700">take-away</span>}
              {b.features?.delivery && <span className="badge bg-blue-100 text-blue-700">delivery</span>}
              {b.features?.pickup   && <span className="badge bg-blue-100 text-blue-700">pickup</span>}
            </div>
            <div className="mt-3 text-xs text-slate-500">
              ☎ {b.contact?.phone}{b.contact?.email && <> · ✉ {b.contact.email}</>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
