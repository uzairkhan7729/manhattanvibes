import {
  BarChart3, Box, Building2, ChefHat, LayoutDashboard, LogOut, Receipt, ShoppingBag, Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthStore } from '../lib/auth-store';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders',    label: 'Orders',    icon: ShoppingBag },
  { to: '/products',  label: 'Products',  icon: Box },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/branches',  label: 'Branches',  icon: Building2 },
  { to: '/reports',   label: 'Reports',   icon: BarChart3 },
];

export function Layout(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const nav2 = useNavigate();

  return (
    <div className="grid h-full grid-cols-[256px_1fr] grid-rows-1">
      {/* Sidebar */}
      <aside className="border-r border-slate-200 bg-white flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-brand-500" />
            <div>
              <div className="font-bold text-slate-900">Manhattan Vibes</div>
              <div className="text-xs text-slate-500">Admin Portal</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-slate-900 truncate">{user?.fullName.en}</div>
            <div className="text-xs text-slate-500">{user?.role}</div>
          </div>
          <button
            onClick={() => { clear(); nav2('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
