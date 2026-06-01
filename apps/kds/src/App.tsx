import { ChefHat, Settings, Wifi, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useKdsQueue } from './lib/use-kds-queue';
import { Column } from './components/Column';
import { Login } from './components/Login';
import { useAuth } from './lib/auth';

export function App(): JSX.Element {
  const auth = useAuth();
  const [branchId, setBranchId] = useState<string | null>(() => localStorage.getItem('kds.branchId'));
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!auth.user) return <Login onLogin={() => { /* re-render via auth hook */ }} />;
  if (!branchId) return <BranchPicker token={auth.accessToken!} onPicked={(id) => { localStorage.setItem('kds.branchId', id); setBranchId(id); }} />;

  return <KitchenScreen branchId={branchId} accessToken={auth.accessToken!} now={now} onSignOut={() => { auth.clear(); localStorage.removeItem('kds.branchId'); setBranchId(null); }} />;
}

function KitchenScreen({ branchId, accessToken, now, onSignOut }: { branchId: string; accessToken: string; now: Date; onSignOut: () => void }): JSX.Element {
  const { queue, connected, bump } = useKdsQueue(branchId, accessToken);

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-orange-500" />
          <div>
            <h1 className="font-bold">Manhattan Vibes — Kitchen Display</h1>
            <p className="text-xs text-slate-400">Branch <span className="text-slate-200">{branchId.slice(-6)}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            {connected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
            <span className={connected ? 'text-emerald-400' : 'text-red-400'}>{connected ? 'live' : 'reconnecting…'}</span>
          </div>
          <div className="font-mono text-slate-300">{now.toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi' })}</div>
          <button className="p-2 rounded hover:bg-slate-800" title="Settings / Sign out" onClick={onSignOut}>
            <Settings className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-4 gap-3 p-3 overflow-hidden">
        <Column title="Incoming"  color="slate"   orders={queue.incoming}  onBump={bump} now={now} />
        <Column title="Preparing" color="amber"   orders={queue.preparing} onBump={bump} now={now} />
        <Column title="Baking"    color="orange"  orders={queue.baking}    onBump={bump} now={now} />
        <Column title="Ready"     color="emerald" orders={queue.ready}     onBump={bump} now={now} />
      </main>
    </div>
  );
}

function BranchPicker({ token, onPicked }: { token: string; onPicked: (id: string) => void }): JSX.Element {
  const [branches, setBranches] = useState<Array<{ _id: string; code: string; name: { en: string } }>>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/v1/branches', { headers: { authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setBranches(j.items ?? []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'failed'));
  }, [token]);
  return (
    <div className="h-full grid place-items-center">
      <div className="w-full max-w-md p-8 rounded-xl bg-slate-800 shadow-2xl">
        <h2 className="text-xl font-bold mb-1">Select kitchen branch</h2>
        <p className="text-sm text-slate-400 mb-6">This screen will display orders for the selected branch.</p>
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <div className="space-y-2">
          {branches.map((b) => (
            <button key={b._id} onClick={() => onPicked(b._id)} className="w-full text-left px-4 py-3 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors">
              <div className="font-medium">{b.name.en}</div>
              <div className="text-xs text-slate-400">{b.code}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
