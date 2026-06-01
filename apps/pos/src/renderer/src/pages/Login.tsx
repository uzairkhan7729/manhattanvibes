import { ChefHat } from 'lucide-react';
import { useState } from 'react';

import { useSession } from '../lib/auth';

export function Login(): JSX.Element {
  const session = useSession();
  const [identifier, setIdentifier] = useState('+923000000003'); // seeded Cashier
  const [password, setPassword] = useState('ChangeMe!2026');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="h-full grid place-items-center">
      <form
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setError(null);
          try { await session.login(identifier, password); }
          catch (err) { setError(err instanceof Error ? err.message : 'Login failed'); }
          finally { setBusy(false); }
        }}
        className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md"
      >
        <div className="flex items-center gap-2 mb-6">
          <ChefHat className="h-7 w-7 text-brand-500" />
          <h1 className="text-xl font-bold">POS sign-in</h1>
        </div>
        <label className="text-xs text-slate-500">Phone or email</label>
        <input className="input mt-1 mb-3" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
        <label className="text-xs text-slate-500">Password</label>
        <input className="input mt-1 mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
