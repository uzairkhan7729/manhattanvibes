# 02 — Software Design Document (SDD)

> Defines the **shape** of the system — modules, responsibilities, interactions, data flow, state machines, and Architecture Decision Records.

## 1. System Decomposition

10 logical modules; the **Central API (M1)** is the only writer of canonical state. All other modules consume/produce via REST + Socket.IO + Webhooks.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLIENT TIER                                         │
│                                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ POS (M2) │  │ Web (M3) │  │Mobile(M4)│  │Admin(M5) │  │ KDS (M10)│  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  │
└────────┼─────────────┼─────────────┼─────────────┼─────────────┼───────┘
         │             │             │             │             │
         │ HTTPS + WSS │             │             │             │
         ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  EDGE: CloudFront / Nginx / WAF / Rate-limit            │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  CENTRAL API (M1) — Node + Express + TS                  │
│                                                                          │
│  Routers ▶ Controllers ▶ Services ▶ Repositories ▶ Mongo/Redis/Queue    │
│                                                                          │
│  Domain Services:                                                        │
│  ├── AuthService      ├── OrderService      ├── PaymentService          │
│  ├── CatalogService   ├── LoyaltyService    ├── PromoService            │
│  ├── InventoryService ├── DeliveryService   ├── ReportService           │
│  ├── CustomerService  ├── BranchService     ├── NotificationService     │
└──┬──────────────────────────────────────────────────────────────────┬───┘
   │                                                                  │
   ▼                                                                  ▼
┌────────────────────────────┐                ┌───────────────────────────┐
│ Data: MongoDB + Redis       │                │ Async: BullMQ workers     │
│ + Object Storage (S3)        │                │ (notifications, reports,  │
│                              │                │  webhooks, sync, exports) │
└────────────────────────────┘                └───────────────────────────┘
```

## 2. Module Responsibility Matrix

| Module | Owns | Consumes | Emits Events |
|---|---|---|---|
| **M1 API** | All canonical data | — | `order.*`, `payment.*`, `inventory.*`, `loyalty.*` |
| **M2 POS** | Local cart, table state, offline queue | catalog, customer, loyalty, promos | `order.created`, `payment.captured`, `pos.sync.*` |
| **M3 Web** | Browser cart, session | catalog, customer, orders, tracking | `customer.session.*`, `order.created` |
| **M4 Mobile** | Local cart, push tokens, geo | catalog, customer, orders, tracking | `order.created`, `device.token.*`, `customer.geo.*` |
| **M5 Admin** | View-only (writes via API) | everything | `admin.action.*` (audit) |
| **M6 Loyalty** | Points ledger, tiers, rewards | order.completed | `loyalty.points.*`, `loyalty.tier.*` |
| **M7 CRM** | Segments, campaigns | customer.*, order.* | `campaign.sent.*` |
| **M8 Delivery** | Drivers, routes, ETAs | order.ready | `driver.location.*`, `delivery.eta.*` |
| **M9 Inventory** | Stock, recipes, POs | order.completed, waste, GRN | `inventory.low.*`, `inventory.adjusted.*` |
| **M10 KDS** | Station queue display | order.confirmed | `kds.bump.*`, `kds.ready.*` |

## 3. End-to-End Flows

### 3.1 Online Customer Order (Web / Mobile)

```
Customer → adds items → checkout
   │
   ▼ POST /api/v1/orders { items, customerId, branchId, channel }
API ├─ validate (Zod) ─ enrich pricing ─ apply coupon/loyalty
    ├─ reserve inventory (transaction)
    ├─ POST to PaymentGateway → 3DS challenge → callback
    │       │
    │       └─ webhook /api/v1/payments/webhook  → mark order.paid
    │
    ├─ emit Socket.IO event "order.confirmed" → KDS, customer tracking
    ├─ enqueue notification (push + SMS) via BullMQ
    └─ return { orderNumber, etaSeconds }
   │
KDS ├─ shows order in "Incoming"
    └─ kitchen bumps → emits "order.ready"
   │
Driver ├─ auto-assigned by DeliveryService
       ├─ accepts pickup → emits "driver.assigned"
       └─ live GPS → "driver.location" → customer app
   │
Delivered → POD captured → "order.delivered" → loyalty points credited
```

### 3.2 In-Store POS Order (Online + Offline)

```
Cashier opens POS → table 5 → adds 2 pizzas → cash payment
   │
   ▼ (Online path)
POS → POST /api/v1/orders → same as 3.1
   │
   ▼ (Offline path — no internet)
POS → write to LocalDB (SQLite) with provisional orderNumber `OFFLINE-{uuid}`
    → print receipt locally
    → enqueue in syncQueue with op="CREATE_ORDER"
   │
[Internet returns]
SyncEngine ├─ POST batch to /api/v1/sync (idempotent via clientOpId)
           ├─ API assigns canonical orderNumber → returns mapping
           ├─ POS reconciles localId ↔ canonicalId
           └─ on conflict: applies merge rule (see doc 09)
```

### 3.3 Promo + Loyalty Application

```
order.subtotal computed → PromoService.evaluate(coupon, customer, branch, time, channel)
  ├─ valid? compute discount
  └─ stackable with loyalty? → LoyaltyService.applyPoints(customer, requestedPoints)
discountedTotal → vat = round(discountedTotal * 0.15 / 1.15)
order.persist with full breakdown (subtotal, discount, loyaltyRedemption, vat, total)
```

## 4. Order State Machine

```
            ┌────────────┐
            │  CREATED   │   (cart submitted, not yet paid for online)
            └─────┬──────┘
                  │ paymentSucceeded()
                  ▼
            ┌────────────┐
            │ CONFIRMED  │ ─── cancel() ──▶ CANCELLED
            └─────┬──────┘
                  │ kitchenAccept()
                  ▼
            ┌────────────┐
            │ PREPARING  │
            └─────┬──────┘
                  │ enterOven()         (pizza-specific stage)
                  ▼
            ┌────────────┐
            │   BAKING   │
            └─────┬──────┘
                  │ bump()
                  ▼
            ┌────────────┐
            │   READY    │
            └─────┬──────┘
                  │ orderType === DELIVERY ? assignDriver() : awaitPickup()
                  ▼
       ┌──────────────────┐
       │ OUT_FOR_DELIVERY │  (only DELIVERY)
       └─────┬────────────┘
             │ pod()
             ▼
       ┌────────────┐
       │ DELIVERED  │
       └─────┬──────┘
             │ closeOrder()
             ▼
       ┌────────────┐
       │   CLOSED   │ ─── refund() ──▶ REFUNDED (partial or full)
       └────────────┘

Disallowed transitions raise DomainError. All transitions audit-logged.
```

## 5. Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Validation | Zod schemas in `packages/validators`, used by API + clients |
| Error format | RFC 7807 problem+json |
| Logging | Pino JSON; request-id correlation across services |
| Tracing | OpenTelemetry → Jaeger/Tempo |
| Metrics | prom-client → Prometheus → Grafana |
| Config | Per-env `.env` validated at boot with Zod |
| Feature flags | Unleash (self-hosted) for safe rollouts |
| Time | All timestamps stored UTC; rendered Asia/Riyadh in UI |
| Money | Stored in halalas (integer SAR/100) to avoid float drift |

## 6. Inter-Module Communication

| From → To | Mechanism | Note |
|---|---|---|
| Client → API | HTTPS REST + WSS | JWT in `Authorization` header |
| API → Client | WSS (Socket.IO) | for KDS, tracking, driver location, admin live |
| API ↔ API workers | BullMQ on Redis | async jobs: notifications, exports, sync, GDPR purge |
| API ↔ Payment | HTTPS outbound + signed webhooks | webhook signature verified |
| API ↔ SMS/Email/WA | HTTPS outbound | retried with backoff |
| API ↔ ZATCA | mTLS to fatoora endpoint | invoice clearance/reporting |
| POS ↔ Printers | ESC/POS over LAN or USB | local Electron service |
| POS ↔ Card Reader | OPI/Sunmi SDK | branch network |

## 7. Multi-Branch Tenancy

- **Single Mongo cluster.** Every business document carries `branchId`.
- **Indexes** are compound `(branchId, ...)`.
- **API middleware** injects `branchId` from JWT for non-SuperAdmin actors.
- **SuperAdmin** queries explicitly scope (`?branchId=...` or `?branchId=all`).
- **Settings (catalog, prices, hours)** stored as: `default` doc + per-branch `overrides`. Resolution: `branch.override ?? default`.

## 8. Data Flow for Sync (POS Offline)

Detailed in [09-POS-ARCHITECTURE.md](09-POS-ARCHITECTURE.md). High-level:

```
LocalDB (SQLite) ──── OutboxTable ──── SyncWorker (Electron main process)
                                            │ batches by entity, ordered by createdAt
                                            ▼
                                  POST /api/v1/sync (idempotent)
                                            │
                                            ▼
                                  SyncResult { applied[], conflicts[] }
                                            │
                                            ▼
                          Local reconciliation + UI toast on conflict
```

## 9. Folder Structure (Central API M1)

```
apps/api/
├── src/
│   ├── main.ts                # bootstrap: express + socket.io + workers
│   ├── config/                # env validation, secrets loading
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.dto.ts
│   │   │   └── auth.spec.ts
│   │   ├── orders/
│   │   ├── catalog/
│   │   ├── customers/
│   │   ├── loyalty/
│   │   ├── promotions/
│   │   ├── inventory/
│   │   ├── branches/
│   │   ├── employees/
│   │   ├── payments/
│   │   ├── delivery/
│   │   ├── notifications/
│   │   ├── reports/
│   │   └── sync/              # POS sync endpoint
│   ├── infra/
│   │   ├── mongo.ts
│   │   ├── redis.ts
│   │   ├── queue.ts           # BullMQ
│   │   ├── socket.ts
│   │   ├── storage.ts         # S3
│   │   └── tracing.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rbac.middleware.ts
│   │   ├── ratelimit.middleware.ts
│   │   ├── audit.middleware.ts
│   │   └── error.middleware.ts
│   ├── workers/
│   │   ├── notification.worker.ts
│   │   ├── report.worker.ts
│   │   ├── sync.worker.ts
│   │   └── webhook.worker.ts
│   └── shared/
│       ├── types/
│       ├── errors/
│       ├── utils/
│       └── eventbus.ts
├── tests/                     # integration + e2e
├── prisma/ or migrations/     # if using a migration tool with Mongo (we use mongo-migrate-ts)
├── Dockerfile
├── tsconfig.json
└── package.json
```

## 10. Architecture Decision Records

| # | Decision | Status | Trade-off |
|---|---|---|---|
| ADR-001 | MongoDB as primary store | Accepted | Flexible schema for menus & orders; risk of unbounded growth → mitigated with TTL + archive |
| ADR-002 | Express over NestJS | Accepted | Smaller surface, faster onboarding for team; rejected: more boilerplate |
| ADR-003 | BullMQ on Redis for async | Accepted | Same Redis serves cache + queue; rejected: SQS (cloud lock-in concerns) |
| ADR-004 | Socket.IO over raw WS | Accepted | Rooms, ack, reconnect built-in |
| ADR-005 | Electron + PWA for POS | Accepted | Single codebase, offline support; rejected: native Win32 (slower iteration) |
| ADR-006 | SQLite for POS local store | Accepted | ACID, embedded, mature; IndexedDB used for transient cache |
| ADR-007 | Money stored as integer halalas | Accepted | Eliminates float rounding bugs |
| ADR-008 | Defer PostgreSQL for OLAP to Phase 2 | Accepted | Phase 1 reporting uses Mongo aggregation + S3 nightly extracts |
| ADR-009 | ZATCA Phase-2 via certified vendor (e.g., Tabby/ZATCA SDK) | Accepted | Compliance certainty > DIY |
| ADR-010 | Multi-branch via row-level tenancy | Accepted | Operationally simple; alternative DB-per-branch rejected as ops nightmare |
| ADR-011 | Strict TypeScript across all apps | Accepted | Lower defect rate; cost: longer initial setup |
| ADR-012 | Trunk-based development | Accepted | Short-lived branches, feature flags for incomplete work |
| ADR-013 | OpenAPI-first API contract → codegen SDKs | Accepted | Eliminates client-server drift |
| ADR-014 | Per-entity last-writer-wins for sync conflicts, with operational merge for cart lines | Accepted | Deterministic and explainable |
| ADR-015 | Apple Pay + STC Pay before WhatsApp ordering | Accepted | Higher conversion lift; defer chat-ordering to Phase 2 |
