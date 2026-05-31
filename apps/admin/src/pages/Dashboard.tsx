import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, DollarSign, TrendingUp, Building2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { api } from '../lib/api';
import { fmtSAR, fmtNumber } from '../lib/format';

interface Branch { _id: string; code: string; name: { en: string; ar?: string }; status: string }
interface DailySummary { branchId: string; date: string; summary: { orders: number; gross: number; vat: number; net: number; delivery: number; disc: number } }

function todayKSA(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
}

export function DashboardPage(): JSX.Element {
  const branches = useQuery({ queryKey: ['branches'], queryFn: () => api.get<{ items: Branch[] }>('/branches') });
  const today = todayKSA();
  const summaries = useQuery({
    queryKey: ['summary-today', branches.data?.items.map((b) => b._id).join(',')],
    enabled: !!branches.data,
    queryFn: async () => {
      const list = branches.data!.items;
      return Promise.all(list.map((b) =>
        api.get<DailySummary>(`/reports/sales/daily?branchId=${b._id}&date=${today}`)
          .then((s) => ({ branch: b, ...s.summary }))
          .catch(() => ({ branch: b, orders: 0, gross: 0, vat: 0, net: 0, delivery: 0, disc: 0 })),
      ));
    },
  });

  const totals = (summaries.data ?? []).reduce((acc, s) => ({
    orders: acc.orders + s.orders,
    gross:  acc.gross  + s.gross,
    net:    acc.net    + s.net,
    branches: acc.branches + 1,
  }), { orders: 0, gross: 0, net: 0, branches: 0 });

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Today — {today} (Asia/Riyadh)</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Orders today" value={fmtNumber(totals.orders)} icon={ShoppingBag} />
        <Kpi label="Gross sales"  value={fmtSAR(totals.gross)} icon={DollarSign} />
        <Kpi label="Net (pre-VAT)" value={fmtSAR(totals.net)} icon={TrendingUp} />
        <Kpi label="Active branches" value={fmtNumber(totals.branches)} icon={Building2} />
      </div>

      <section className="card p-6">
        <h2 className="font-semibold mb-4">Sales by branch — today</h2>
        <div className="h-64">
          {summaries.data && (
            <ResponsiveContainer>
              <BarChart data={summaries.data.map((s) => ({ branch: s.branch.code, sales: s.gross / 100 }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" />
                <YAxis />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)} SAR`} />
                <Bar dataKey="sales" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }): JSX.Element {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500">{label}</div>
        <Icon className="h-5 w-5 text-brand-500" />
      </div>
      <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
