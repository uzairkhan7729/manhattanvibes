# @mv/kds — Kitchen Display System

PWA kiosk for the kitchen. React + Vite + Tailwind + Socket.IO.

## Run

```powershell
npm run dev --workspace=@mv/kds   # http://localhost:5174
```

Sign in with seeded cashier `+966500000003` / `ChangeMe!2026`, then pick a branch.

## How it works

- Initial queue snapshot via `GET /api/v1/kds/queue?branchId=...`
- Live updates via Socket.IO `/kds` namespace, room `branch:<id>:kitchen`
- Click an order card to bump → `POST /api/v1/kds/bump/:orderId` (advances state)
- Age timer per card; > 8 min = amber ring, > 12 min = red ring
- Reconnect indicator (wifi icon)
