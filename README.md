# Manhattan Vibes — Restaurant Ecosystem

**Client:** Manhattan Vibes (KSA) · **Built by:** Codlight Technologies

End-to-end multi-branch restaurant platform: central API + admin portal + customer web + customer mobile + kitchen display + offline-capable POS. Per the [SDD](docs/02-SDD-SOFTWARE-DESIGN.md) and [TDD](docs/03-TDD-TECHNICAL-DESIGN.md).

---

## Quickstart (5 minutes)

```powershell
# 0. Prereqs: Node 20+, npm 10+, Docker Desktop
npm install

# 1. Database + Redis + Mailhog + MinIO
npm run infra:up

# 2. API setup (one-time)
cd apps/api
cp .env.example .env.local
node scripts/generate-dev-keys.mjs   # generates dev RSA keypair into .env.local
cd ../..

# 3. Seed the database (admin/cashier/customer users, 2 branches, 6 categories, 15 products)
npm run seed --workspace=@mv/api

# 4. Start the API (port 8088)
npm run dev --workspace=@mv/api

# 5. In another terminal, run any of the UIs:
npm run dev --workspace=@mv/admin     # http://localhost:5173 — admin portal
npm run dev --workspace=@mv/kds       # http://localhost:5174 — kitchen display
npm run dev --workspace=@mv/web       # http://localhost:3001 — customer website
npm run dev --workspace=@mv/pos       # opens Electron POS window
```

**Seeded credentials** (password `ChangeMe!2026`):

| Role | Phone | Email |
|---|---|---|
| SuperAdmin     | `+966500000001` | `admin@manhattanvibes.sa` |
| BranchManager  | `+966500000002` | `manager.ruh1@manhattanvibes.sa` |
| Cashier        | `+966500000003` | `cashier.ruh1@manhattanvibes.sa` |
| Customer       | `+966555000001` | `customer@example.com` |

**End-to-end smoke test** — exercises the full backend:
```powershell
npm run smoke --workspace=@mv/api     # 12 checks: health, auth, catalog, order, pay, KDS, reports
```

---

## Repository layout

```
manhattan-vibes/
├── apps/
│   ├── api/                # Module 1 — Central API (Express + TS + Mongo + Redis + Socket.IO)
│   ├── admin/              # Module 5 — Admin Portal (React + Vite + Tailwind)
│   ├── kds/                # Module 10 — Kitchen Display (React + Vite + Socket.IO)
│   ├── web/                # Module 3 — Customer Website (Next.js 15 App Router)
│   ├── pos/                # Module 2 — Point of Sale (Electron + React + SQLite, offline-first)
│   └── mobile/             # Module 4 — Customer Mobile (React Native + Expo) — installs separately
├── packages/
│   ├── shared-types/       # TS interfaces consumed by all apps
│   ├── validators/         # Zod schemas (request/response validation)
│   ├── tsconfig/           # Shared TypeScript configs
│   └── eslint-config/      # Shared ESLint preset
├── docs/                   # 22 SDD/TDD documents + diagrams + schemas
└── docker-compose.yml      # Mongo (replSet rs0), Redis, Mailhog, MinIO
```

---

## Backend modules (all live)

| # | Module | Endpoints |
|---|---|---|
| 1 | Auth | register, login, OTP request/verify, refresh (rotating), logout, /me |
| 2 | Customers | CRUD, addresses, marketing prefs, PDPL anonymize |
| 3 | Branches | CRUD, opening hours, delivery zones, atomic order-number allocator |
| 4 | Employees | staff CRUD, shift clock-in/out |
| 5 | Tables | CRUD, merge, split, transfer, assign |
| 6 | Catalog | categories, products, toppings, pizza-builder price quote, branch overrides |
| 7 | Orders | quote, place, transition, modify, cancel — full state machine, Socket.IO emit |
| 8 | Payments | gateway adapter (sandbox, cash), intent/capture/refund/webhook |
| 9 | Loyalty | accounts, tiers (bronze/silver/gold/platinum), append-only ledger, redemption |
| 10 | Promotions | coupons (percent/flat/freeDelivery/freeItem), validate, campaigns |
| 11 | Inventory | items, per-branch stock, recipes, POs, GRN, waste |
| 12 | Delivery | drivers, GPS heartbeat, job assignment, POD |
| 13 | KDS | live queue snapshot, bump endpoint, Socket.IO emission |
| 14 | Notifications | templates, console provider (Phase 1), device tokens |
| 15 | Reports | sales daily/range, VAT (ZATCA-aligned 15% inclusive) |
| 16 | Sync | POS offline batch sync, deltas, snapshot — per-op idempotency |

---

## Design documents

The full enterprise SDD/TDD set lives in [`docs/`](docs/):

| # | Document | # | Document |
|---|---|---|---|
| 00 | [Executive Summary](docs/00-EXECUTIVE-SUMMARY.md) | 12 | [Admin Portal Architecture](docs/12-ADMIN-PORTAL-ARCHITECTURE.md) |
| 01 | [BRD](docs/01-BRD-BUSINESS-REQUIREMENTS.md) | 13 | [KDS Architecture](docs/13-KDS-ARCHITECTURE.md) |
| 02 | [SDD](docs/02-SDD-SOFTWARE-DESIGN.md) | 14 | [Loyalty & CRM](docs/14-LOYALTY-CRM.md) |
| 03 | [TDD](docs/03-TDD-TECHNICAL-DESIGN.md) | 15 | [Inventory & Delivery](docs/15-INVENTORY-DELIVERY.md) |
| 04 | [System Architecture](docs/04-SYSTEM-ARCHITECTURE.md) | 16 | [Payment Gateway](docs/16-PAYMENT-GATEWAY.md) |
| 05 | [Database Design](docs/05-DATABASE-DESIGN.md) | 17 | [Notifications](docs/17-NOTIFICATIONS.md) |
| 06 | [API Specification](docs/06-API-SPECIFICATION.md) | 18 | [Reporting](docs/18-REPORTING.md) |
| 07 | [Security Architecture](docs/07-SECURITY-ARCHITECTURE.md) | 19 | [UI/UX Design](docs/19-UIUX-DESIGN.md) |
| 08 | [DevOps & Deployment](docs/08-DEVOPS-DEPLOYMENT.md) | 20 | [Testing Strategy](docs/20-TESTING-STRATEGY.md) |
| 09 | [POS Architecture](docs/09-POS-ARCHITECTURE.md) | 21 | [UAT & Go-Live](docs/21-UAT-GOLIVE.md) |
| 10 | [Ecommerce Architecture](docs/10-ECOMMERCE-ARCHITECTURE.md) | 22 | [Scalability Roadmap](docs/22-SCALABILITY-ROADMAP.md) |
| 11 | [Mobile App Architecture](docs/11-MOBILE-APP-ARCHITECTURE.md) |    | |

C4 diagrams in [`docs/diagrams/`](docs/diagrams/), example Mongoose schemas in [`docs/schemas/`](docs/schemas/).

---

## Tooling

```powershell
npm run typecheck          # tsc across all workspaces
npm run test               # vitest where present
npm run build              # production builds
npm run infra:up           # docker compose up
npm run infra:down         # docker compose down
npm run format             # prettier
```

Ports:
- API: 8088
- Admin: 5173
- KDS: 5174
- Web: 3001
- POS: Electron window (no port)
- MinIO: 9100 (API), 9101 (console)
- Mailhog: 1025 (SMTP), 8025 (web UI)
- Mongo: 27018 (host) → 27017 (container, rs0 replica set)
- Redis: 6380 (host) → 6379 (container)

---

## Mobile app (separate install workflow)

`apps/mobile` is intentionally excluded from root npm workspaces. Install + run:

```powershell
cd apps/mobile
npx expo install
$env:EXPO_PUBLIC_API_BASE = "http://YOUR-LAN-IP:8088"   # device/emulator needs LAN-reachable API
npx expo start
```

See [apps/mobile/README.md](apps/mobile/README.md).

---

## Status

| Workstream | State |
|---|---|
| 22 design documents (BRD, SDD, TDD, …) | ✅ delivered |
| Central API + 16 modules | ✅ live, 12/12 smoke checks passing |
| Database (seeded) | ✅ live via docker-compose |
| Admin Portal | ✅ runnable |
| Kitchen Display | ✅ runnable |
| Customer Website | ✅ runnable |
| POS (offline-first) | ✅ runnable |
| Mobile (RN + Expo) | ✅ scaffolded; install separately |
