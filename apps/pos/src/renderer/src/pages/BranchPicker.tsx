import { useEffect, useState } from 'react';

import { useSession } from '../lib/auth';
import { API_BASE } from '../lib/config';

interface Branch { _id: string; code: string; name: { en: string } }

export function BranchPicker(): JSX.Element {
  const session = useSession();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/branches`, { headers: { authorization: `Bearer ${session.accessToken!}` } })
      .then((r) => r.json())
      .then((j) => setBranches(j.items ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, [session.accessToken]);

  return (
    <div className="h-full grid place-items-center">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h2 className="text-lg font-bold mb-1">Select branch</h2>
        <p className="text-sm text-slate-500 mb-4">This terminal will operate against this branch until signed out.</p>
        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
        <div className="space-y-2">
          {branches.map((b) => (
            <button key={b._id} className="btn-tile w-full" onClick={() => session.setBranch(b._id)}>
              <div className="font-medium">{b.name.en}</div>
              <div className="text-xs text-slate-500">{b.code}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
