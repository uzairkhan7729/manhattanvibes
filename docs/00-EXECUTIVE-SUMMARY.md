# 00 — Executive Summary

**Project:** Manhattan Vibes — Omnichannel Restaurant Ecosystem
**Owner:** Manhattan Vibes
**Delivery Partner:** Codlight Technologies
**Target Markets:** Kingdom of Saudi Arabia (Phase 1), GCC expansion (Phase 2)
**Document Version:** 1.0 — 2026-05-31

---

## 1. Vision

Manhattan Vibes will operate a multi-branch pizza/QSR brand with a digital backbone that matches or exceeds the operational maturity of Pizza Hut, Domino's, and Papa John's. Customers will order through a website, mobile app, in-store POS, or phone — all surfacing the **same catalog, prices, loyalty balance, and order status in real time**. Operations (kitchen, drivers, managers, head office) will work from a single source of truth.

## 2. Business Drivers

| Driver | Impact |
|---|---|
| **Direct-to-customer ordering** | Reduce dependence on aggregators (HungerStation, Jahez, ToYou) charging 18–30% commission |
| **Multi-branch scalability** | Open new branches in <2 weeks with zero engineering work |
| **Operational efficiency** | KDS + offline POS targets 15% faster ticket times |
| **Loyalty + CRM** | Increase repeat-order rate from industry baseline ~22% to >35% within 12 months |
| **Saudi market readiness** | VAT 15%, ZATCA Phase-2 e-invoicing, Arabic/RTL, Mada/STC Pay |

## 3. System at a Glance

Ten cooperating modules, one central API:

```
                       ┌────────────────────────────┐
                       │      Central API (M1)      │
                       │  Node/Express/TS/Mongo/Redis│
                       └─────────────┬──────────────┘
        ┌──────────┬─────────────────┼────────────────┬─────────────┐
        │          │                 │                │             │
   ┌────▼───┐ ┌────▼───┐       ┌────▼────┐      ┌────▼────┐   ┌────▼────┐
   │POS (M2)│ │Web (M3)│       │Mobile M4│      │Admin M5 │   │ KDS M10 │
   │ Electron│ │Next.js │       │ RN/Expo │      │  React  │   │ React+IO│
   └────────┘ └────────┘       └─────────┘      └─────────┘   └─────────┘

   Cross-cutting services (live inside API or as deployable microservices):
   M6 Loyalty │ M7 CRM │ M8 Delivery │ M9 Inventory
```

## 4. Scope Summary

**In scope (Phase 1):**
- Central API platform (auth, orders, products, customers, loyalty, coupons, promotions, inventory, branches, employees, reports, delivery, payments, notifications)
- POS with full offline-first capability
- Customer ecommerce (Next.js)
- Native mobile apps (iOS + Android)
- Admin portal
- Kitchen Display System
- Loyalty (tiers + rewards) and CRM (segmentation + campaigns)
- Delivery management with driver app
- Inventory management
- KSA payment rails (Mada, Apple Pay, STC Pay, Visa, MasterCard)
- Notifications (push, SMS, email, WhatsApp)
- Reports (sales, inventory, profit, tax/VAT)
- Multi-branch support, RBAC, audit, ZATCA-compliant e-invoicing

**Out of scope (Phase 1 — candidates for roadmap):**
- AI menu optimization, drone delivery, voice ordering, self-service kiosks (Phase 2/3 — see [22-SCALABILITY-ROADMAP.md](22-SCALABILITY-ROADMAP.md)).

## 5. Investment Summary

| Phase | Duration | Cost Profile (relative) |
|---|---|---|
| Discovery + Setup | 1 month | ▓ |
| Build (parallel streams) | 14 months | ▓▓▓▓▓▓▓▓▓▓ |
| UAT + Hardening | 1.5 months | ▓▓ |
| Go-Live + Hypercare | 1 month | ▓ |
| **Total** | **~18 months** | — |

Peak team: ~22 engineers + design + PM. See `README.md` for phased headcount.

## 6. Success Metrics (Year 1 post go-live)

| KPI | Target |
|---|---|
| Direct-channel order share (vs. aggregators) | >55% |
| App store rating | ≥4.5 (iOS), ≥4.4 (Android) |
| POS offline uptime | 100% (true offline operation) |
| Order-to-kitchen latency | <3 seconds (P95) |
| API availability | 99.95% monthly |
| Mean kitchen ticket time | <12 minutes (P50) |
| NPS | >55 |
| Repeat customer rate (90-day) | >35% |

## 7. Key Architectural Decisions (preview)

1. **Single central API, polyglot clients.** All UIs are thin; business rules live in M1.
2. **Offline-first POS** using Electron + IndexedDB + local SQLite, with a deterministic sync engine and last-writer-wins-with-merge conflict resolution scoped per entity.
3. **Mongo + Redis** as the operational store; PostgreSQL added in roadmap for OLAP/reporting (Phase 2) — see ADR-008.
4. **Socket.IO** for real-time (KDS, order tracking, driver location).
5. **Strict TypeScript** across every app; shared types package eliminates client-server drift.
6. **ZATCA Phase-2 e-invoicing** baked in from day one, not bolted on.
7. **Multi-tenant per branch** at the data layer (branchId scoping) — no separate DBs.

Full ADR list in [02-SDD-SOFTWARE-DESIGN.md §10](02-SDD-SOFTWARE-DESIGN.md).

## 8. Top Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Offline POS sync conflicts corrupt data | Per-entity versioning, deterministic merge rules, mandatory dry-run reconciliation in staging |
| Aggregator dependency erodes margin | Direct apps prioritized in Phase 1; aggregator integration deferred to Phase 2 |
| Mada/STC Pay onboarding delays | Begin payment partner KYC in Discovery; ship with Visa/MC first if blocked |
| ZATCA compliance audit failure | Engage approved compliance vendor; QR + cryptographic stamp validated in QA gate |
| Peak-load (Ramadan iftar surge) | Load-tested to 10× baseline; Redis-backed rate limits; horizontal autoscale; pre-warmed pods |
| Single-region cloud outage | Multi-AZ from day one; Phase 2 cross-region DR (see roadmap) |

## 9. Approvals

| Role | Name | Signature | Date |
|---|---|---|---|
| CEO, Manhattan Vibes | _____ | _____ | _____ |
| CTO, Codlight Technologies | _____ | _____ | _____ |
| Head of Operations | _____ | _____ | _____ |
| CISO / Security Reviewer | _____ | _____ | _____ |
