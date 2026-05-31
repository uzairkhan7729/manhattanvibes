import { ChefHat } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '../lib/auth';

export function Login({ onLogin }: { onLogin: () => void }): JSX.Element {
  const auth = useAuth();
  const [identifier, setIdentifier] = useState('+966500000003');     // seeded cashier
  const [password, setPassword] = useState('ChangeMe!2026');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await auth.login(identifier, password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full grid place-items-center">
      <div className="w-full max-w-md p-8 rounded-xl bg-slate-800 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <ChefHat className="h-8 w-8 text-orange-500" />
          <div>
            <h1 className="text-xl font-bold">KDS sign-in</h1>
            <p className="text-sm text-slate-400">Kitchen Display System</p>
          </div>
        </div>
        <form onSubmit={go} className="space-y-3">
          <input className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 focus:border-orange-500 outline-none"
                 placeholder="Phone or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          <input className="w-full px-3 py-2 rounded-md bg-slate-700 border border-slate-600 focus:border-orange-500 outline-none"
                 placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button className="w-full px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 font-medium disabled:opacity-50" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
