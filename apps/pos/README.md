# @mv/pos — Point of Sale

Electron + React + Vite + better-sqlite3. **Offline-first**.

## Run

```powershell
npm run infra:up                          # mongo + redis
npm run dev --workspace=@mv/api           # API on :8088
npm run dev --workspace=@mv/pos           # opens Electron window
```

Sign in with the seeded cashier `+966500000003` / `ChangeMe!2026`, pick the RUH-1 branch.

## How it works

| Layer | Responsibility |
|---|---|
| **Main (Node)** | App lifecycle, local SQLite (WAL), outbox, sync drain |
| **Preload bridge** | Typed `window.mv` API (kv, outbox) over IPC |
| **Renderer (React)** | UI — login, branch picker, sales screen, top-bar status |
| **Sync engine (renderer)** | Polls `/health/ready` → marks net state ONLINE/DEGRADED/OFFLINE; calls main's `outbox.drain()` on a cadence |

## Offline behavior

1. Cashier creates an order → enqueued to local SQLite outbox with a `clientOpId`.
2. UI shows order immediately (optimistic).
3. Drain loop POSTs batches to `/api/v1/sync` (idempotent by `clientOpId`).
4. If offline, items stay queued; UI top-bar shows `OFFLINE` + queue depth.
5. When connectivity returns, drain catches up automatically.

## Local DB location

`%APPDATA%/mv-pos/pos.db` (Windows) — encrypted in production builds (SQLCipher),
plain SQLite in dev.
