import { ChefHat } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';

export function LoginPage(): JSX.Element {
  const [identifier, setIdentifier] = useState('+923000000001');
  const [password, setPassword] = useState('ChangeMe!2026');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const nav = useNavigate();

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ accessToken: string; refreshToken: string; expiresIn: number; user: { id: string } }>('/auth/login', { identifier, password });
      const me = await fetch('/api/v1/auth/me', { headers: { authorization: `Bearer ${r.accessToken}` } }).then((res) => res.json());
      setSession(me, r.accessToken, r.refreshToken, r.expiresIn);
      nav('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full grid place-items-center bg-gradient-to-br from-slate-50 to-brand-50 p-6">
      <div className="card w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <ChefHat className="h-8 w-8 text-brand-500" />
          <div>
            <h1 className="text-xl font-bold">Manhattan Vibes</h1>
            <p className="text-sm text-slate-500">Admin sign-in</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Phone or email</label>
            <input className="input mt-1" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Password</label>
            <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-slate-500 mt-6 leading-relaxed">
          Seeded credentials:<br />
          <code className="text-slate-700">+923000000001</code> (SuperAdmin) /
          <code className="text-slate-700"> ChangeMe!2026</code>
        </p>
      </div>
    </div>
  );
}
