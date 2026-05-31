import { ChefHat, Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';

import { useSession } from '../lib/auth';
import type { NetState } from '../lib/sync';

export function TopBar({ net, queueDepth }: { net: NetState; queueDepth: number }): JSX.Element {
  const session = useSession();
  const netColor = net === 'online' ? 'text-emerald-600' : net === 'degraded' ? 'text-amber-600' : 'text-red-600';
  const NetIcon = net === 'offline' ? CloudOff : Cloud;

  return (
    <header className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <ChefHat className="h-5 w-5 text-brand-500" />
        <span className="font-bold">Manhattan Vibes POS</span>
        <span className="ml-3 text-xs text-slate-500">branch <span className="text-slate-800 font-mono">{session.branchId?.slice(-6)}</span></span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className={`flex items-center gap-1.5 ${netColor}`}>
          <NetIcon className="h-4 w-4" />
          <span className="capitalize">{net}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600" title="Queued sync ops">
          <RefreshCw className={`h-4 w-4 ${queueDepth > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          <span>{queueDepth} queued</span>
        </div>
        <div className="text-slate-700">{session.user?.fullName.en}</div>
        <button className="btn-ghost px-2 py-1" onClick={() => session.clear()} title="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
