import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { api } from '../lib/api';
import { fmtSAR } from '../lib/format';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

interface SalesRow { _id: string | object; orders: number; gross: number; vat: number; total: number }

export function ReportsPage(): JSX.Element {
  const [from, setFrom] = useState(isoDaysAgo(14));
  const [to, setTo] = useState(new Date().toISOString());

  const salesByDay = useQuery({
    queryKey: ['sales-range', from, to],
    queryFn: () => api.get<{ groupBy: string; rows: SalesRow[] }>(`/reports/sales/range?from=${from}&to=${to}&groupBy=day`),
  });

  const vat = useQuery({
    queryKey: ['vat', from, to],
    queryFn: () => api.get<{ summary: { vatOut: number; salesNet: number; salesGross: number } }>(`/reports/vat?from=${from}&to=${to}`),
  });

  const rows = salesByDay.data?.rows ?? [];
  const chartData = rows.map((r) => ({ day: String(r._id), sales: r.gross / 100, orders: r.orders }));

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-slate-500">Sales analytics & VAT.</p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-slate-500">From</label>
            <input type="datetime-local" className="input"
                   value={from.slice(0, 16)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
          </div>
          <div>
            <label className="text-xs text-slate-500">To</label>
            <input type="datetime-local" className="input"
                   value={to.slice(0, 16)} onChange={(e) => setTo(new Date(e.target.value).toISOString())} />
          </div>
        </div>
      </header>

      <section className="card p-6">
        <h2 className="font-semibold mb-4">Sales by day</h2>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(v: number, name) => name === 'sales' ? `Rs ${Math.round(v).toLocaleString('en-PK')}` : v} />
                <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full grid place-items-center text-slate-500">No paid orders in this range yet</div>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold mb-4">VAT (ZATCA-aligned, 15% inclusive)</h2>
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div><dt className="text-slate-500">Gross sales</dt><dd className="text-xl font-bold">{fmtSAR(vat.data?.summary.salesGross)}</dd></div>
          <div><dt className="text-slate-500">Net of VAT</dt><dd className="text-xl font-bold">{fmtSAR(vat.data?.summary.salesNet)}</dd></div>
          <div><dt className="text-slate-500">VAT output</dt><dd className="text-xl font-bold">{fmtSAR(vat.data?.summary.vatOut)}</dd></div>
        </dl>
      </section>
    </div>
  );
}
