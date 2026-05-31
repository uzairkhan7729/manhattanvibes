# 03 — Technical Design Document (TDD)

> Component-level technical specification. Where the SDD says "what," the TDD says "how, with which libraries, at which versions, with which interfaces."

## 1. Technology Stack (pinned for Phase 1)

### 1.1 Central API (M1)

| Concern | Choice | Version |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Language | TypeScript | 5.6+ |
| HTTP framework | Express | 5.x |
| Validation | Zod | 3.x |
| ORM/ODM | Mongoose | 8.x |
| Cache & queue broker | Redis (Elasticache or self-hosted) | 7.x |
| Queue | BullMQ | 5.x |
| Realtime | Socket.IO | 4.x with Redis adapter |
| Auth | jsonwebtoken (RS256) | 9.x |
| Password hash | bcrypt | 5.x (cost 12) |
| HTTP client | undici | 6.x |
| Logging | Pino | 9.x + pino-http |
| Tracing | @opentelemetry/api + auto-instrumentations | latest |
| Metrics | prom-client | 15.x |
| OpenAPI | zod-to-openapi + swagger-ui-express | latest |
| Testing | Vitest + Supertest + Testcontainers | latest |
| Migrations | mongo-migrate-ts | latest |
| Process mgr | PM2 (bare-metal) / native (k8s) | — |

### 1.2 POS (M2)

| Concern | Choice |
|---|---|
| UI framework | React 18 |
| Shell | Electron 31+ (Chromium 126) |
| PWA fallback | Workbox |
| State | Redux Toolkit + RTK Query |
| Routing | React Router 6 |
| Local DB | SQLite via better-sqlite3 (synchronous, no native binding hell on Win) |
| Browser-side cache | IndexedDB via idb |
| Auto-update | electron-updater (delta via Squirrel.Windows) |
| Printing | escpos + node-thermal-printer; receipt templates as HTML→canvas fallback |
| Hardware integration | OPOS / Sunmi / Verifone SDK adapters |
| Build | Vite + electron-vite |
| Testing | Vitest + Playwright (E2E on built app) |

### 1.3 Web Ecommerce (M3)

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Rendering | ISR + RSC for catalog, CSR for cart/checkout |
| State | Zustand (cart) + RTK Query (server data) |
| Styling | Tailwind 3 + shadcn/ui + Radix |
| Forms | React Hook Form + Zod |
| Maps | Mapbox GL JS (delivery zone preview) |
| Payments SDK | HyperPay COPYandPAY widget (Phase 1) |
| Image | next/image + Cloudflare R2/Images |
| i18n | next-intl |
| Testing | Vitest + Playwright |

### 1.4 Mobile (M4)

| Concern | Choice |
|---|---|
| Framework | React Native 0.76 (new architecture / Hermes) |
| Tooling | Expo SDK 52 (EAS Build, EAS Update) |
| Navigation | React Navigation 7 |
| State | Redux Toolkit + RTK Query |
| Local storage | MMKV (sync) + SQLite (history cache) |
| Push | expo-notifications (FCM + APNs) |
| Maps | react-native-maps (Apple/Google) |
| Payments | Stripe RN SDK + Apple Pay native + STC Pay native module |
| Biometrics | expo-local-authentication |
| Testing | Jest + Detox |

### 1.5 Admin Portal (M5)

| Concern | Choice |
|---|---|
| Framework | Vite + React 18 |
| Data | RTK Query + TanStack Table |
| UI | Tailwind + shadcn/ui |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Auth | Auth.js with API JWT |

### 1.6 KDS (M10)

| Concern | Choice |
|---|---|
| Framework | React 18 (PWA, kiosk mode in Chromium) |
| Realtime | Socket.IO client |
| Audio | Web Audio API (bump chime) |
| Hardware | bump bar via Keyboard API |

## 2. Cross-App Shared Packages

```
packages/
├── shared-types/      # interfaces: Order, Product, Customer, etc.
├── validators/        # Zod schemas (request, response, domain)
├── sdk-client/        # auto-generated from OpenAPI
├── ui-kit/            # tailwind preset, primitives, icons
├── i18n/              # ar.json, en.json with namespacing
└── eslint-config/     # airbnb + ts + react + import sort
```

Versioned via Changesets, published to private npm registry (Verdaccio or GitHub Packages).

## 3. Central API — Layered Architecture

```
HTTP Request
    │
    ▼
[Express] Router → [Middleware: auth, rbac, ratelimit, audit, requestId]
    │
    ▼
Controller (thin: parse, call service, format response)
    │
    ▼
Service (business logic, transactions, calls other services)
    │
    ▼
Repository (Mongo queries, encapsulated; no business logic)
    │
    ▼
[Mongo / Redis / S3 / Queue]
```

**Rule:** Controllers never touch Mongo directly. Services never construct HTTP responses. Repositories never know about HTTP.

## 4. Authentication & Authorization

### 4.1 Token Strategy

- **Access token (JWT RS256):** 15 min TTL, signed with private key (KMS-backed). Payload: `{ sub, role, branchIds[], tenantId, jti, iat, exp }`.
- **Refresh token:** 7 days, stored hashed (SHA-256) in `RefreshTokens` collection with `jti`, `userId`, `deviceId`, `userAgent`, `ip`, `revokedAt`. **Rotated on every refresh** (old jti revoked, new issued).
- **Reuse detection:** if a revoked refresh token is presented, revoke entire device family → force re-login (per OWASP refresh token rotation guidance).

### 4.2 RBAC

```ts
type Role = 'SuperAdmin' | 'BranchManager' | 'Cashier' | 'KitchenStaff' | 'Driver' | 'Marketing' | 'Customer';

const permissions: Record<Role, string[]> = {
  SuperAdmin:    ['*'],
  BranchManager: ['orders:*', 'inventory:*', 'employees:read', 'reports:branch', 'promotions:read'],
  Cashier:       ['orders:create', 'orders:read', 'orders:modify-pre-kitchen', 'payments:capture'],
  KitchenStaff:  ['orders:read', 'orders:state:advance'],
  Driver:        ['orders:read:assigned', 'orders:state:delivered'],
  Marketing:     ['campaigns:*', 'segments:*', 'customers:read'],
  Customer:      ['orders:create', 'orders:read:own', 'profile:*'],
};
```

Enforcement: `requirePermission('orders:create')` middleware compares JWT claims to required permission; for branch-scoped data, additionally enforces `req.branchId ∈ token.branchIds`.

### 4.3 Audit Logs

Mongo collection `audit_logs` capped by date partition. Each write-mutating endpoint logs:

```json
{
  "ts": "...",
  "actor": { "userId": "...", "role": "...", "ip": "...", "ua": "..." },
  "action": "order.refund",
  "target": { "type": "order", "id": "...", "branchId": "..." },
  "before": { ... },
  "after":  { ... },
  "requestId": "..."
}
```

## 5. Persistence Patterns

### 5.1 Transactions

- Mongo replica-set transactions used where multi-document atomicity is required (order + inventory decrement + payment record + loyalty ledger).
- Long-running operations use the **Outbox pattern**: write the domain change + an outbox event in one transaction; a worker publishes to the bus.

### 5.2 Optimistic Concurrency

- Every mutable document carries `version: number`. Updates use `findOneAndUpdate({ _id, version: n }, { $set: ..., $inc: { version: 1 } })`. Mismatch → 409 `concurrent-modification`.

### 5.3 Pagination

- Cursor-based (`?after=<base64-encoded(_id,createdAt)>&limit=50`). Stable under inserts. Total-count is opt-in (`?withTotal=true`) because it's expensive.

### 5.4 Caching

- Redis with namespaced keys: `mv:catalog:{branchId}:{lang}`.
- Cache-aside on read; explicit invalidation on write events.
- Short TTL fallback (60s) to bound staleness if event missed.

## 6. Realtime (Socket.IO) Design

| Namespace | Rooms | Events |
|---|---|---|
| `/kds` | `branch:{id}:kitchen` | `order.confirmed`, `order.bumped`, `order.ready` |
| `/tracking` | `order:{id}` | `order.state.changed`, `driver.location` |
| `/admin` | `branch:{id}:admin` | `order.created`, `inventory.low`, `payment.received` |
| `/driver` | `driver:{id}` | `order.assigned`, `route.updated`, `customer.message` |

Authenticated by JWT in handshake. Redis adapter scales horizontally. Backpressure: client emits acks; server retries with exponential backoff (max 3) then queues for delivery on reconnect.

## 7. Error Handling Standard (RFC 7807)

```json
{
  "type": "https://api.manhattanvibes.sa/errors/insufficient-stock",
  "title": "Insufficient stock",
  "status": 409,
  "detail": "Product 'Pepperoni Pizza Large' has 0 units available at branch RUH-1.",
  "instance": "/orders",
  "requestId": "01J...",
  "fields": { "items[0].productId": "P_001" }
}
```

Standard error codes table in `docs/06-API-SPECIFICATION.md §10`.

## 8. Idempotency

- All `POST` mutations accept header `Idempotency-Key: <uuid>`.
- Server stores `{ key, requestHash, responseStatus, responseBody }` in Redis (TTL 24h).
- Replay returns stored response. Mismatch on requestHash → 422 `idempotency-key-conflict`.

## 9. Internationalization (i18n)

- All entity text fields stored as `{ ar: "...", en: "..." }`.
- API returns based on `Accept-Language` header; fallback `ar`.
- Currency formatted server-side (3-decimal halalas SAR).
- Date/time rendered Asia/Riyadh.

## 10. Configuration & Secrets

| Where | What |
|---|---|
| `.env.example` (committed) | placeholder vars |
| AWS Secrets Manager / Doppler | runtime secrets |
| Kubernetes Secrets | mounted as env at pod start |
| Local dev | `.env.local` (git-ignored) |
| Boot validation | Zod schema rejects missing/invalid keys |

Secrets rotation cadence: KMS keys yearly, DB passwords quarterly, JWT signing key yearly (with grace window for old kid).

## 11. Performance Budgets

| Surface | Budget |
|---|---|
| API P50 / P95 / P99 | 80ms / 250ms / 600ms |
| Catalog endpoint cache hit ratio | >85% |
| Mongo P95 query | <50ms |
| Web LCP | <2.0s on 3G |
| Web TTI | <3.5s |
| Mobile cold start | <2.5s |
| POS local action (add to cart) | <50ms |
| POS sync batch (100 orders) | <4s |

## 12. Coding Standards (excerpt — full in `README.md`)

- ESLint: `airbnb-typescript`, custom rules: no default exports (named only), no enum types (use union literals), no `any` (use `unknown` + Zod).
- All async code uses `async/await`; no raw `.then()`.
- Service methods return typed Result-like discriminated unions only at module boundaries to standardize expected error paths; throw for unexpected.
- DTO files separate from domain types.
- File naming: `kebab-case.ts`; React components: `PascalCase.tsx`.
- One default per file unless a barrel re-export.
- Imports sorted: node builtins → external → workspace → relative.
- Max function length: 50 lines (soft); max file: 400.

## 13. Build & Bundling

| App | Tool | Output |
|---|---|---|
| API | esbuild via tsup | single-file `dist/main.js` |
| Web | Next.js | `.next/standalone` |
| Mobile | Expo EAS | `.ipa` / `.aab` |
| POS | electron-vite | NSIS installer (.exe) + auto-update channel |
| Admin/KDS | Vite | static `dist/` served by Nginx |

## 14. Versioning Policy

- **API:** URI versioning `/api/v1/...`; breaking changes go to `/api/v2/...` with a sunset header on v1 for 6 months minimum.
- **Mobile/POS:** semver with mandatory minimum version stored in `/health/min-versions`; older clients receive 426 Upgrade Required.

## 15. Acceptance Testing Hooks

- Each module exposes deterministic fixtures (`/test/seed`) gated by `NODE_ENV=test`.
- Date is injectable (a `Clock` provider) for time-based tests (Ramadan promo, tier expiry).
