# 09 — POS Architecture (Offline-First)

> The single most critical reliability requirement: **POS must work fully offline.** Internet is treated as a luxury, not a dependency.

## 1. Form Factor & Distribution

- **PWA + Electron** single React+TS codebase.
- Electron shell distributed as signed NSIS installer for Windows 11 (primary), with builds also produced for macOS (development) and Linux (Sunmi T2 with Android-x86 fallback).
- PWA fallback served from `https://pos.manhattanvibes.sa` for emergency use on any browser (e.g., manager's laptop).
- Auto-update via `electron-updater` with staged rollout (see DevOps doc).

## 2. Process Topology (Per Terminal)

```
┌────────────────────────── Electron App ──────────────────────────┐
│                                                                  │
│  Main process (Node)                                             │
│   ├── App lifecycle, auto-updater                                │
│   ├── Local SQLite (via better-sqlite3, SQLCipher-encrypted)     │
│   ├── Printer drivers (escpos)                                   │
│   ├── Card-reader bridge (OPOS/Sunmi/Verifone SDK)               │
│   ├── Sync engine (Outbox + retry + conflict resolution)         │
│   └── IPC bus → renderer                                         │
│                                                                  │
│  Renderer process (React/Redux Toolkit)                          │
│   ├── UI surfaces (Sales, Tables, Orders, Reports)               │
│   ├── IndexedDB (warm cache, last-known-good catalog)            │
│   └── Workbox PWA service worker                                  │
└──────────────────────────────────────────────────────────────────┘
```

Per branch we also run **one** "edge sync node" (Electron headless) on a small NUC that:
- Mirrors local-network catalog cache (LAN HTTP)
- Brokers between terminals during multi-terminal table service
- Is optional — terminals work fully alone too.

## 3. Local Data Layout (SQLite)

Tables (canonical):
- `catalog_categories`, `catalog_products`, `catalog_toppings`, `catalog_prices_branch`
- `customers_lite` (customers seen by this branch lately)
- `tables`
- `orders` + `order_items` + `order_payments`
- `outbox` (operations awaiting sync)
- `inbox` (deltas pulled from API)
- `device_meta` (device id, branch id, last sync cursor, schema version)
- `kv` (misc settings, encrypted blobs)

SQLite is the **source of truth for offline operations**; once synced, server is authoritative.

## 4. Operation Lifecycle

Every state-changing action produces an **operation** with:

```ts
type Op = {
  clientOpId: string;          // uuid v7 (sortable)
  ts: string;                  // ISO UTC
  deviceId: string;
  branchId: string;
  actorUserId: string;
  op: 'ORDER_CREATE' | 'ORDER_MODIFY' | 'ORDER_CANCEL' | 'PAYMENT_CAPTURE'
    | 'PAYMENT_REFUND' | 'TABLE_ASSIGN' | 'TABLE_MERGE' | 'TABLE_SPLIT'
    | 'CUSTOMER_UPSERT' | 'INVENTORY_ADJUST' | 'SHIFT_OPEN' | 'SHIFT_CLOSE';
  payload: unknown;
  sequence: number;            // monotonic per device
  causality?: string[];        // dependent clientOpIds (e.g., PAYMENT depends on ORDER)
  status: 'pending' | 'syncing' | 'acked' | 'conflict' | 'failed';
  attempts: number;
  lastError?: string;
}
```

Ops are appended to `outbox` and immediately applied locally for instant UX.

## 5. Sync Engine

```
   ┌───────────────────────────────────────────────────────────┐
   │  SyncEngine (main process; runs every 5s when online,     │
   │  every 30s when degraded, off when offline)               │
   ├───────────────────────────────────────────────────────────┤
   │  1. Pull deltas    GET /sync/changes?since=cursor          │
   │     → apply to local (catalog, customers, promos, etc.)   │
   │                                                            │
   │  2. Drain outbox   POST /sync   { ops: [...batch up to 50]}│
   │     - in causal order (topological sort by `causality`)   │
   │     - signed with device cert (HMAC) for tamper-evidence  │
   │     - server returns per-op result                        │
   │                                                            │
   │  3. Reconcile:                                             │
   │     - 'applied'    → mark acked, store canonical ids      │
   │     - 'duplicate'  → idempotency hit, mark acked          │
   │     - 'conflict'   → resolve via rules (§7), retry        │
   │     - 'invalid'    → mark failed, surface to manager UI   │
   │                                                            │
   │  4. Update cursor; emit `sync.heartbeat` to UI            │
   └───────────────────────────────────────────────────────────┘
```

Backoff: exponential with jitter (1s → 60s cap). On 401, refresh device token; on 5xx, retain & retry; on schema-version mismatch (426), prompt force-update.

## 6. Network State Machine

```
       ┌─ ONLINE ────────────────────┐
       │   - 200 OK from /health/ready│
       │   - WSS connected            │
       │   sync every 5s              │
       └────────┬────────┬────────────┘
                │        │
       degraded │        │ failed health 3x
       (3 timeouts)      │
                │        │
                ▼        ▼
        DEGRADED         OFFLINE
        - retry slower   - no network calls
        - WSS attempting - rely solely on local
        - sync every 30s   sync resumes when ONLINE
```

## 7. Conflict Resolution Strategy

Conflicts are **resolved per entity** with explicit rules, not by global "last writer wins."

| Entity | Default rule | Notes |
|---|---|---|
| `Order` (CREATE) | Server canonicalises orderNumber on apply; conflict only if same `clientOpId` differs | Idempotent by design |
| `Order` (MODIFY) | If server's `state` is past `CONFIRMED`, reject client modify → surface to cashier ("kitchen already started") | Cashier issues refund/cancel via new op |
| `Payment` | Idempotent on `gatewayRefs.txnId`; conflicting amounts → manager review | |
| `Inventory adjust` | Additive — apply `delta` server-side from a base reading | Avoids "two cashiers each set qty=10" collisions |
| `Customer upsert` | Field-level merge: server keeps newer per-field by `lastWrittenAt` | DOB never overwritten by null |
| `Table state` | Operational merge: assignment & merge accept additive sets; if topology conflicts (terminal A merged 1+2, terminal B split 1) → forklift latest reasonable graph and alert | Rare; mitigated by branch edge node coordination |
| `Shift open/close` | Sequence enforced; close while server thinks shift is closed → no-op | |

Cashier sees a manager-only **Conflict Inbox** when human intervention is required (typically <1 per branch per week).

## 8. Causality

`PAYMENT_CAPTURE` op specifies `causality: [orderClientOpId]`. Sync engine ensures order ops apply before payment ops. If parent failed permanently, dependent ops auto-fail with reason.

## 9. Time Drift

Each terminal NTP-syncs to `time.cloudflare.com` hourly. Clock drift threshold ±60s tolerated; beyond that, sync engine refuses to drain outbox and surfaces "Set clock" banner. Server timestamps win for ordering; client timestamps stored for audit.

## 10. Catalog & Pricing Updates

- Pull deltas via `GET /sync/changes?since=`.
- Apply atomically; renderer subscribes via IPC and re-renders.
- New catalog activation can be scheduled (`effectiveAt`) so all terminals flip simultaneously at, e.g., 06:00 KSA.
- If terminal misses an update window (was offline), it stays on prior catalog and warns cashier; manager can force-pull.

## 11. Printing

- Receipt template rendered as HTML in renderer, converted to ESC/POS via `escpos-template`.
- Kitchen ticket separately styled (larger fonts, station-routed).
- Print queue local in `outbox`-like pattern; retries on transient printer error; failed prints alert cashier.

## 12. Card Reader / EMV

- Adapter per gateway: HyperPay POS terminal (Pax/Verifone), Geidea POS.
- Pin-pad runs autonomous transaction; POS receives outcome (`approved/declined`, `gatewayRefs`).
- POS records `PAYMENT_CAPTURE` op with method and refs; reconciled with server on next sync.

## 13. Cash Drawer & Shift Reconciliation

- Cash drawer opens via printer pulse.
- Cashier "opens shift" with float; closes with cash count.
- Variance report compares expected (system) vs counted (cashier); manager approval to close shift if variance > threshold.
- Shift summary uploads to server even if branch went offline mid-shift.

## 14. Multi-Terminal Coordination Within a Branch

When 3 cashiers are open with overlapping table assignments:
- The edge sync node (if present) brokers a CRDT-like view for tables (PN-counter for seat allocations, OR-set for table memberships).
- Without an edge node, terminals each maintain own table view and sync via server when online. Single-cashier branches are the common case.

## 15. Security on POS

- SQLite DB encrypted with per-device key, derived from device cert + Windows DPAPI.
- Auto-update signed with EV cert; refuses unsigned updates.
- Idle lock screen requires cashier PIN.
- Manager actions (refund > 200 SAR, discount > 10%, void after kitchen accept) require manager PIN.
- All actions audit-logged locally and uploaded.

## 16. Observability on POS

- Local rolling logs (Pino, gzip rotate).
- On-error upload to API → Sentry.
- Heartbeat every 60s (`device.heartbeat`) carrying version, queue depth, last sync, free disk, printer status.

## 17. Failure Modes & Manager UX

| Failure | UX |
|---|---|
| Internet down | Banner "Offline — orders saved locally". All actions proceed |
| API up but DB sync lagging | Banner "Sync slow — X pending" |
| Schema mismatch (POS too old) | Modal: "Update required. Cashier can continue but cannot sync. Manager please install update." |
| Card reader offline | Cash & Apple Pay (NFC if on-device) still available; card pay disabled with note |
| Printer offline | Receipt displayed full-screen; option to print to alternative printer; ticket emailed to customer |
| Local disk full | Hard error; manager must clean up old shifts / archive |

## 18. Sample Sync Sequence (offline → online)

```
T-2h: Internet drops. POS continues. 47 orders + 47 payments + 12 inventory adjusts queued.
T0:   Internet returns.
T0+1s: SyncEngine wakes, finds outbox=106 ops.
T0+1s: GET /sync/changes?since=cur=... → 3 catalog deltas, 1 promo update applied.
T0+2s: POST /sync { ops: ops[0..49] }  → 200 OK, 50 applied.
T0+3s: POST /sync { ops: ops[50..99] } → 200 OK, 49 applied, 1 conflict (manager inbox).
T0+4s: POST /sync { ops: ops[100..105] } → 200 OK, 6 applied.
T0+5s: cursor advanced; UI banner: "Synced 105 ops. 1 needs manager review."
```
