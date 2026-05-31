# 01 — Business Requirements Document (BRD)

## 1. Purpose

Define **what** the Manhattan Vibes ecosystem must do (business view), independent of how it is built. The SDD/TDD (docs 02–03) define **how**.

## 2. Stakeholders

| Stakeholder | Interest |
|---|---|
| Customers | Easy, fast ordering across channels; reliable tracking; rewards |
| Branch Cashiers | Fast POS, never blocked by internet |
| Branch Managers | Daily Z-reports, shift control, inventory visibility |
| Kitchen Staff | Clear, prioritized order queue; no paper tickets |
| Drivers | Optimized routes; clear pickup/dropoff |
| Marketing | Campaigns, coupons, segmentation |
| Finance | VAT/ZATCA compliance, P&L per branch |
| Head Office (Ops) | Multi-branch dashboards, KPIs |
| IT / Codlight | Maintainable, observable, secure system |
| Regulators (ZATCA) | E-invoicing compliance |

## 3. Functional Requirements (FR)

Each requirement has an ID (`FR-<MODULE>-<n>`), priority (M=Must / S=Should / C=Could), and acceptance criteria.

### 3.1 Authentication (FR-AUTH)

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-AUTH-1 | Email/password registration & login | M | Bcrypt cost ≥12; password rules per OWASP ASVS 4.0 |
| FR-AUTH-2 | OTP login via SMS (mobile/web/app) | M | 6-digit, 5-min TTL, rate-limited 3/min/number |
| FR-AUTH-3 | Social login (Google, Apple) | S | iOS app: Apple Sign-In mandatory per App Store policy |
| FR-AUTH-4 | JWT access (15 min) + refresh (7 day rotating) | M | Refresh tokens hashed at rest, single-use |
| FR-AUTH-5 | RBAC with roles: SuperAdmin, BranchManager, Cashier, KitchenStaff, Driver, Marketing, Customer | M | Permissions matrix in doc 07 |
| FR-AUTH-6 | 2FA optional for staff, mandatory for SuperAdmin | M | TOTP (RFC 6238) |
| FR-AUTH-7 | Audit trail of all auth events | M | 13-month retention |

### 3.2 Catalog (FR-CAT)

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-CAT-1 | Product CRUD (name AR/EN, description, image, base price, SKU) | M | i18n required |
| FR-CAT-2 | Category hierarchy (max depth 3) | M | Drag-drop reorder in admin |
| FR-CAT-3 | Pizza builder: base, size, sauce, cheese, toppings, crust style | M | Real-time price recalc; max toppings limit per size |
| FR-CAT-4 | Addons (extra cheese, drinks, sides) with linked products | M | — |
| FR-CAT-5 | Deals & combos with conditional rules ("buy 2 get 1") | M | Engine in doc 14 |
| FR-CAT-6 | Branch-level price overrides | M | Override stored separately, falls back to base |
| FR-CAT-7 | Availability toggle per branch (86'd items) | M | Real-time push to all channels via Socket.IO |
| FR-CAT-8 | Nutritional info (KSA SFDA compliance for menus >300 cal) | M | — |

### 3.3 Ordering (FR-ORD)

| ID | Requirement | Priority | Acceptance |
|---|---|---|---|
| FR-ORD-1 | Order types: Dine-in, Take-away, Delivery, Pickup | M | — |
| FR-ORD-2 | Cart with line items, modifiers, notes | M | Modifier prices roll up |
| FR-ORD-3 | Hold/recall orders (POS only) | M | Held orders survive POS restart |
| FR-ORD-4 | Modify order pre-kitchen-confirm; refund flow after | M | KitchenAcceptedAt is the cutoff |
| FR-ORD-5 | Cancel order with reason code + manager override after kitchen accepted | M | Audit logged |
| FR-ORD-6 | Order numbering: branch-prefixed sequential (e.g., RUH-1-000123) | M | Monotonic per branch, resets daily |
| FR-ORD-7 | Order states: Created → Confirmed → Preparing → Baking → Ready → OutForDelivery → Delivered → Closed (or → Cancelled / Refunded) | M | State machine in doc 02 |

### 3.4 Tables & Dine-in (FR-TBL)

| ID | Requirement | Priority |
|---|---|---|
| FR-TBL-1 | Table CRUD per branch with seat capacity | M |
| FR-TBL-2 | Assign order to table | M |
| FR-TBL-3 | Merge tables (combine orders) | M |
| FR-TBL-4 | Split tables (split bill by item or by share) | M |
| FR-TBL-5 | Transfer table between sections / waiters | M |
| FR-TBL-6 | Table status: Free, Occupied, Reserved, Cleaning | M |

### 3.5 Payments (FR-PAY)

| ID | Requirement | Priority |
|---|---|---|
| FR-PAY-1 | Methods: Cash, Card (Mada/Visa/MC), Apple Pay, STC Pay | M |
| FR-PAY-2 | Split payment across methods | M |
| FR-PAY-3 | Refunds (full + partial), traceable to original | M |
| FR-PAY-4 | Tips (web/app/POS) — distributed per branch policy | S |
| FR-PAY-5 | Customer credit/wallet balance | M |
| FR-PAY-6 | ZATCA Phase-2 e-invoice (QR + cryptographic stamp) attached to every paid order | M |

### 3.6 Loyalty (FR-LOY)

| ID | Requirement | Priority |
|---|---|---|
| FR-LOY-1 | 1 SAR spend = 1 point (configurable) | M |
| FR-LOY-2 | Tiers: Bronze / Silver / Gold / Platinum with auto-upgrade/downgrade rules | M |
| FR-LOY-3 | Redeem points at checkout (100 pts = 1 SAR, configurable) | M |
| FR-LOY-4 | Birthday rewards (auto-issued 7 days before DOB) | M |
| FR-LOY-5 | Referral program (referrer + referee each get bonus on referee's 1st paid order) | M |
| FR-LOY-6 | Points expire 12 months after last earn activity | S |

### 3.7 Promotions & Coupons (FR-PROMO)

| ID | Requirement | Priority |
|---|---|---|
| FR-PROMO-1 | Coupon codes: % off, flat off, free item, free delivery | M |
| FR-PROMO-2 | Stacking rules per coupon | M |
| FR-PROMO-3 | Channel restriction (app-only, web-only, etc.) | M |
| FR-PROMO-4 | Time-bounded campaigns (e.g., Ramadan 6pm–9pm) | M |
| FR-PROMO-5 | First-order coupon for new customers | M |

### 3.8 Inventory (FR-INV)

| ID | Requirement | Priority |
|---|---|---|
| FR-INV-1 | Ingredients with units (kg, g, L, ml, pcs) | M |
| FR-INV-2 | Recipe links (product → ingredients with quantities) | M |
| FR-INV-3 | Auto-decrement stock on order completion | M |
| FR-INV-4 | Reorder level alerts (push to branch manager) | M |
| FR-INV-5 | Waste recording with reason codes | M |
| FR-INV-6 | Purchase order workflow with vendor + goods receipt | M |
| FR-INV-7 | Stock count / variance report | M |

### 3.9 Branches & Employees (FR-BR)

| ID | Requirement | Priority |
|---|---|---|
| FR-BR-1 | Unlimited branches with address, geofence, opening hours | M |
| FR-BR-2 | Delivery zones per branch (polygon) | M |
| FR-BR-3 | Branch-level menu & pricing overrides | M |
| FR-BR-4 | Employee CRUD with branch assignment, role, shift | M |
| FR-BR-5 | Clock-in / clock-out + shift reports | S |

### 3.10 Delivery (FR-DEL)

| ID | Requirement | Priority |
|---|---|---|
| FR-DEL-1 | Driver CRUD with vehicle, license, photo | M |
| FR-DEL-2 | Auto/manual driver assignment | M |
| FR-DEL-3 | Route optimization (≥2 stops batched within window) | S |
| FR-DEL-4 | Live driver location to customer (Socket.IO) | M |
| FR-DEL-5 | Proof-of-delivery (signature/photo/OTP) | M |
| FR-DEL-6 | Delivery analytics (avg time, on-time %, driver leaderboard) | M |

### 3.11 KDS (FR-KDS)

| ID | Requirement | Priority |
|---|---|---|
| FR-KDS-1 | Queues: Incoming, Preparing, Baking, Ready, Completed | M |
| FR-KDS-2 | Real-time push from API (Socket.IO) | M |
| FR-KDS-3 | Bump screen — kitchen marks item/order ready | M |
| FR-KDS-4 | SLA timer per order with red flag past target | M |
| FR-KDS-5 | Multi-station support (pizza station, cold station, drinks) | S |

### 3.12 Notifications (FR-NOT)

| ID | Requirement | Priority |
|---|---|---|
| FR-NOT-1 | Push (FCM/APNs) to customer + driver apps | M |
| FR-NOT-2 | SMS (KSA-compliant via Unifonic/Taqnyat) | M |
| FR-NOT-3 | Email (transactional via SES/Postmark) | M |
| FR-NOT-4 | WhatsApp (via WA Business API, template-based) | S |
| FR-NOT-5 | Per-customer channel preferences with opt-out | M |

### 3.13 Reporting (FR-REP)

| ID | Requirement | Priority |
|---|---|---|
| FR-REP-1 | Sales: hourly, daily, monthly, by branch, by cashier, by channel | M |
| FR-REP-2 | Inventory: stock-on-hand, consumption, waste, variance | M |
| FR-REP-3 | Customer: cohorts, repeat rate, AOV, LTV | M |
| FR-REP-4 | Profit per product, per branch | M |
| FR-REP-5 | Tax & VAT reports, ZATCA-aligned | M |
| FR-REP-6 | Export CSV / Excel / PDF | M |
| FR-REP-7 | Scheduled email delivery of daily/weekly reports | S |

## 4. Non-Functional Requirements (NFR)

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | **Availability** | API: 99.95% monthly. POS: 100% (offline-capable) |
| NFR-2 | **Performance** | API P95 < 250ms; web LCP < 2.0s; mobile cold start < 2.5s |
| NFR-3 | **Scalability** | Sustain 5× peak Ramadan load (≈600 orders/min) without degradation |
| NFR-4 | **Security** | OWASP ASVS L2; pen-test pass; encryption at rest & in transit |
| NFR-5 | **Compliance** | KSA PDPL, ZATCA Phase-2 e-invoicing, SFDA nutrition labels, PCI-DSS SAQ A (no card data stored) |
| NFR-6 | **Observability** | Structured logs (Pino), metrics (Prom), traces (OTel), SLOs |
| NFR-7 | **Recoverability** | RTO 1h, RPO 5min for API; PITR for Mongo Atlas |
| NFR-8 | **Maintainability** | TS strict, ≥80% coverage on API, CI gate |
| NFR-9 | **Localization** | Arabic (RTL) + English, every screen |
| NFR-10 | **Accessibility** | WCAG 2.1 AA for web/admin/mobile |
| NFR-11 | **Browser support** | Latest 2 Chrome/Edge/Safari/Firefox + iOS Safari 14+ |
| NFR-12 | **Mobile OS** | iOS 14+, Android 9+ |
| NFR-13 | **Data residency** | Primary region in KSA (RIYADH); backups encrypted, cross-AZ |
| NFR-14 | **Auditability** | All state-mutating actions audit-logged with actor + before/after |

## 5. Business Rules (BR)

- **BR-1:** VAT 15% applied per ZATCA rules; inclusive on menu prices.
- **BR-2:** Order can be modified only before kitchen acceptance; after that, refund flow.
- **BR-3:** Refund > 200 SAR requires manager approval; > 1000 SAR requires head-office approval.
- **BR-4:** Loyalty points earned only on **paid** orders; refunds reverse points.
- **BR-5:** Customer cannot use referral code on own account.
- **BR-6:** Driver may not see customer phone number until pickup (privacy); contact via masked-number proxy.
- **BR-7:** Negative stock allowed for ingredients (advisory alert), blocked for finished SKUs.
- **BR-8:** Tax invoice number per ZATCA: branch-prefix + serial, never reused.
- **BR-9:** Delivery zone is a polygon; orders outside zone are blocked at checkout with "pickup only" suggestion.
- **BR-10:** Promo codes capped at 1 stack with loyalty redemption unless explicitly flagged.

## 6. Out of Scope (Phase 1)

- Self-service kiosks
- Drive-thru ordering
- Voice ordering (Alexa/Google)
- Drone/robot delivery
- AI menu personalization (basic recommendations only)
- Franchisee billing portal
- Aggregator integrations (HungerStation, Jahez, ToYou) — see roadmap

## 7. Assumptions

- Mongo Atlas dedicated cluster available in KSA region (or self-hosted on STC Cloud / OCI Riyadh).
- SMS provider contracts in place before Phase 6.
- Mada/STC Pay merchant onboarding completes during Phase 0–1.
- Hardware (POS terminals, printers, KDS screens) procured separately per branch.

## 8. Dependencies

- ZATCA fatoora portal access (compliance vendor).
- SMS gateway (Unifonic, Taqnyat, or equivalent).
- Payment gateway (HyperPay, Moyasar, or Checkout.com — final selection in doc 16).
- Map/routing provider (Google Maps + Mapbox fallback).
