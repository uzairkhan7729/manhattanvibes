import { useEffect, useState } from 'react';

import { useSession } from './lib/auth';
import { useSync } from './lib/sync';
import { Login } from './pages/Login';
import { BranchPicker } from './pages/BranchPicker';
import { Sales } from './pages/Sales';
import { TopBar } from './components/TopBar';

export function App(): JSX.Element {
  const session = useSession();
  const sync = useSync(session.accessToken);
  const [loaded, setLoaded] = useState(false);

  // Wait one tick for the persistence layer to hydrate before painting decisions
  useEffect(() => { setTimeout(() => setLoaded(true), 50); }, []);

  if (!loaded) return <div className="h-full grid place-items-center text-slate-500">Loading…</div>;
  if (!session.user) return <Login />;
  if (!session.branchId) return <BranchPicker />;

  return (
    <div className="h-full flex flex-col">
      <TopBar net={sync.net} queueDepth={sync.queueDepth} />
      <Sales />
    </div>
  );
}
