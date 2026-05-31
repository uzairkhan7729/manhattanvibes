import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter, Navigate } from 'react-router-dom';

import './index.css';
import { Layout } from './components/Layout';
import { useAuthStore } from './lib/auth-store';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { OrdersPage } from './pages/Orders';
import { OrderDetailPage } from './pages/OrderDetail';
import { ProductsPage } from './pages/Products';
import { CustomersPage } from './pages/Customers';
import { ReportsPage } from './pages/Reports';
import { BranchesPage } from './pages/Branches';

function RequireAuth({ children }: { children: React.ReactNode }): JSX.Element {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'orders',    element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderDetailPage /> },
      { path: 'products',  element: <ProductsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'branches',  element: <BranchesPage /> },
      { path: 'reports',   element: <ReportsPage /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
