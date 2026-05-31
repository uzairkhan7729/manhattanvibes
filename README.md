# Manhattan Vibes — Restaurant Ecosystem

**Client:** Manhattan Vibes (KSA)
**Built and Maintained By:** Codlight Technologies
**Document Set Version:** 1.0
**Date:** 2026-05-31

This repository contains the complete enterprise-grade Software Design Document (SDD) and Technical Design Document (TDD) for the Manhattan Vibes restaurant ecosystem — a multi-branch, omnichannel platform comparable in scope and quality to Pizza Hut, Domino's, and Papa John's.

## Document Index

| # | Document | Purpose |
|---|----------|---------|
| 00 | [Executive Summary](docs/00-EXECUTIVE-SUMMARY.md) | Vision, scope, phases, investment |
| 01 | [Business Requirements (BRD)](docs/01-BRD-BUSINESS-REQUIREMENTS.md) | Functional + non-functional requirements |
| 02 | [Software Design Document (SDD)](docs/02-SDD-SOFTWARE-DESIGN.md) | Modules, interactions, data flow |
| 03 | [Technical Design Document (TDD)](docs/03-TDD-TECHNICAL-DESIGN.md) | Component-level technical specification |
| 04 | [System Architecture](docs/04-SYSTEM-ARCHITECTURE.md) | Logical, physical & deployment topology |
| 05 | [Database Design (ERD + MongoDB Schema)](docs/05-DATABASE-DESIGN.md) | Collections, indexes, aggregation |
| 06 | [API Specification](docs/06-API-SPECIFICATION.md) | Full REST catalog + webhooks |
| 07 | [Security Architecture](docs/07-SECURITY-ARCHITECTURE.md) | JWT, RBAC, OWASP, encryption |
| 08 | [DevOps & Deployment](docs/08-DEVOPS-DEPLOYMENT.md) | Docker, CI/CD, monitoring, backups |
| 09 | [POS Architecture (Offline-First)](docs/09-POS-ARCHITECTURE.md) | Electron+PWA, sync engine, conflict resolution |
| 10 | [Ecommerce Architecture](docs/10-ECOMMERCE-ARCHITECTURE.md) | Next.js website |
| 11 | [Mobile App Architecture](docs/11-MOBILE-APP-ARCHITECTURE.md) | React Native + Expo |
| 12 | [Admin Portal Architecture](docs/12-ADMIN-PORTAL-ARCHITECTURE.md) | React back-office |
| 13 | [KDS Architecture](docs/13-KDS-ARCHITECTURE.md) | Kitchen Display System |
| 14 | [Loyalty & CRM](docs/14-LOYALTY-CRM.md) | Tiers, campaigns, segmentation |
| 15 | [Inventory & Delivery](docs/15-INVENTORY-DELIVERY.md) | Ingredients, drivers, routing |
| 16 | [Payment Gateway Design](docs/16-PAYMENT-GATEWAY.md) | Mada, Apple Pay, STC Pay, Visa, MC |
| 17 | [Notifications](docs/17-NOTIFICATIONS.md) | Push, SMS, Email, WhatsApp |
| 18 | [Reporting Module](docs/18-REPORTING.md) | Sales, VAT, Inventory, Profit |
| 19 | [UI/UX Design](docs/19-UIUX-DESIGN.md) | Sitemaps, navigation, wireframes |
| 20 | [Testing Strategy](docs/20-TESTING-STRATEGY.md) | Unit, integration, perf, security |
| 21 | [UAT & Go-Live Plan](docs/21-UAT-GOLIVE.md) | Acceptance, cutover, rollback |
| 22 | [Scalability Roadmap](docs/22-SCALABILITY-ROADMAP.md) | 12–36 month evolution |

## Repository Layout (recommended for the codebase that will implement this design)

```
manhattan-vibes/
├── apps/
│   ├── api/              # Module 1 — Central API (Node + Express + TS)
│   ├── pos/              # Module 2 — POS (React + Electron + PWA)
│   ├── web/              # Module 3 — Ecommerce (Next.js)
│   ├── mobile/           # Module 4 — Mobile App (React Native + Expo)
│   ├── admin/            # Module 5 — Admin Portal (React)
│   └── kds/              # Module 10 — Kitchen Display (React + Socket.IO)
├── packages/
│   ├── shared-types/     # TS interfaces shared across apps
│   ├── ui-kit/           # Tailwind + Radix components
│   ├── sdk-client/       # Generated API client (OpenAPI codegen)
│   ├── validators/       # Zod schemas (request/response validation)
│   └── i18n/             # ar / en translation bundles
├── infra/
│   ├── docker/           # Dockerfiles per app
│   ├── k8s/              # Helm charts
│   ├── terraform/        # IaC for cloud
│   └── github-actions/   # CI/CD workflow templates
├── docs/                 # ← this folder
└── pnpm-workspace.yaml
```

## Coding Standards (applies to all apps)

- **Language:** TypeScript strict mode everywhere (`noImplicitAny`, `strictNullChecks`).
- **Lint/Format:** ESLint (airbnb-typescript) + Prettier. Pre-commit hooks via Husky + lint-staged.
- **Commit Style:** Conventional Commits (`feat:`, `fix:`, `chore:`, `BREAKING CHANGE:`).
- **Branching:** Trunk-based with short-lived feature branches → PR → squash-merge.
- **Test Coverage Gate:** ≥80% statements for `api`, ≥70% for client apps.
- **Definition of Done:** code merged + unit/integration tests + i18n keys + docs + analytics events fired.
- **i18n:** All user-facing strings via `t('key')`. RTL support mandatory (Arabic).
- **Accessibility:** WCAG 2.1 AA for web/mobile/admin.

## Estimated Development Phases

| Phase | Duration | Headcount | Scope |
|-------|----------|-----------|-------|
| 0. Discovery & Setup | 4 weeks | 4 | Requirements lock, infra bootstrap, design system |
| 1. Core API + Admin MVP | 10 weeks | 8 | Auth, products, orders, branches, basic admin |
| 2. POS (online) + KDS | 8 weeks | 6 | In-store ordering, kitchen flow |
| 3. POS Offline Engine | 6 weeks | 4 | Local SQLite, sync, conflict resolution |
| 4. Ecommerce Website | 8 weeks | 5 | Next.js, pizza builder, checkout |
| 5. Mobile App (iOS + Android) | 10 weeks | 5 | RN + Expo, push, tracking |
| 6. Loyalty + CRM + Promotions | 6 weeks | 4 | Tiers, coupons, campaigns |
| 7. Delivery + Driver App | 6 weeks | 4 | Routing, tracking |
| 8. Payment Integrations | 4 weeks | 3 | Mada, Apple Pay, STC Pay |
| 9. Reporting + BI | 4 weeks | 3 | Reports, exports, VAT |
| 10. Hardening + UAT | 6 weeks | full | Pen-test, load test, UAT |
| 11. Go-Live + Hypercare | 4 weeks | full | Cutover, 2-week hypercare |

**Total runway:** ~76 weeks (≈18 months) with parallelized streams.
**Peak headcount:** ~22 (8 backend, 4 mobile, 4 web, 2 QA, 1 PM, 1 UX, 1 DevOps, 1 architect).
