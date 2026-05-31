# @mv/admin — Admin Portal

Vite + React 18 + TypeScript + Tailwind + TanStack Query.

## Run

```powershell
npm run infra:up                          # mongo + redis (from repo root)
npm run dev --workspace=@mv/api           # API on :8088
npm run dev --workspace=@mv/admin         # admin on :5173 (proxies /api → :8088)
```

Open http://localhost:5173 — sign in with seeded SuperAdmin:
- `+966500000001` / `ChangeMe!2026`

## Surfaces

- `/dashboard` — today's KPIs, sales by branch
- `/orders` — live list, filter by state, detail with timeline + transition controls
- `/products` — catalog grouped by category
- `/customers` — search by phone/email/name
- `/branches` — locations grid
- `/reports` — sales over time, VAT
