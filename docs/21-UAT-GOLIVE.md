# 21 — UAT & Go-Live Plan

## 1. UAT (User Acceptance Testing)

### 1.1 Purpose

Validate that the platform satisfies stakeholder business expectations end-to-end **before** customer exposure.

### 1.2 UAT Roles

| Role | Responsibility |
|---|---|
| UAT Lead (Codlight PM) | Owns plan, schedule, sign-off |
| Business Sponsor (Manhattan Vibes) | Final UAT acceptance |
| Branch Manager (pilot) | Validates POS + KDS in real branch |
| Cashiers (3+) | Use POS in supervised shifts |
| Marketing | Validates CRM, campaigns, segmentation |
| Finance | Validates VAT, reconciliation, ZATCA pack |
| QA (Codlight) | Test execution, defect triage |
| Drivers (3+) | Validates driver app + routing |

### 1.3 UAT Environment

- Dedicated staging cluster, prod-mirrored config (PII-scrubbed data).
- Real payment gateways in sandbox mode.
- ZATCA sandbox endpoint.
- Real SMS sender with safelist of UAT phone numbers (no broadcast).
- Test app distributed via TestFlight + Play Internal track.

### 1.4 UAT Scope (test scripts maintained per area)

| Area | Scripts |
|---|---|
| Auth | TS-AUTH-01..10 (signup, login, OTP, MFA, reset, social, lockout) |
| Catalog | TS-CAT-01..15 (CRUD, builder, branch overrides, 86, availability) |
| Order (web) | TS-WEB-01..20 (cart, coupon, loyalty, delivery, pickup, tracking) |
| Order (mobile) | TS-MOB-01..20 (same + push, biometrics, offline cart) |
| Order (POS) | TS-POS-01..25 (dine-in, take-away, delivery, hold/recall, split bill, tables) |
| POS Offline | TS-POS-OFF-01..10 (offline orders, sync, conflicts, recovery) |
| KDS | TS-KDS-01..08 (bump, recall, SLA, station filter, recovery) |
| Delivery | TS-DEL-01..10 (assign, batched, POD, failed) |
| Loyalty | TS-LOY-01..12 (earn, redeem, tier change, expiry, referrals) |
| Promotions | TS-PROMO-01..10 (codes, channels, stacking, edge cases) |
| Inventory | TS-INV-01..10 (PO → GRN → consume, waste, variance) |
| Payments | TS-PAY-01..15 (every method + 3DS + refunds + split) |
| Reports & VAT | TS-REP-01..10 + TS-ZATCA-01..05 |
| Admin | TS-ADM-01..15 |
| Security | TS-SEC-01..10 (RBAC, session, rate-limit, audit) |
| Performance | TS-PERF-01..03 (load, Ramadan sim, sync depth) |

Each script: prerequisites, steps, expected, actual, status, defects.

### 1.5 Defect Workflow

- Logged in JIRA project `MV-UAT`.
- Severity (SEV1–4) per [doc 20 §13](20-TESTING-STRATEGY.md).
- UAT cannot conclude with any SEV1/SEV2 open.
- Daily triage standup during UAT window.

### 1.6 UAT Sign-Off Criteria

- 100% scripts executed.
- 0 SEV1/SEV2 open.
- <5 SEV3 open with mitigation/workaround plan.
- Business sponsor formal sign-off (e-signed).

---

## 2. Pilot Branch (Soft Launch)

### 2.1 Strategy

Before all-branch go-live, run **one pilot branch** for **2 weeks** with limited customer marketing.

### 2.2 Pilot Goals

- Validate POS in real shifts (open–close, every payment method, real Ramadan-like surge if applicable).
- Validate kitchen ops with KDS.
- Validate delivery flow with real drivers + real customers.
- Capture real telemetry to tune SLOs and scaling.
- Train staff with vendor on-site for first 3 days.

### 2.3 Pilot Exit Criteria

- ≥98% order success rate.
- Zero data-loss incidents.
- <1% POS sync conflicts requiring manager intervention.
- Z-report ties to actual cash count within ±0.5%.
- Customer NPS ≥ 50 across pilot period.

---

## 3. Cutover (Production Go-Live)

### 3.1 Pre-Go-Live Checklist (T-7 days)

- [ ] All UAT signed off.
- [ ] Pilot branch exit criteria met.
- [ ] Pen-test report reviewed; criticals closed.
- [ ] DR drill passed within last 30 days.
- [ ] Backup restore tested.
- [ ] Payment gateways in production mode, settlement bank accounts verified.
- [ ] ZATCA production CSIDs issued per branch.
- [ ] SMS sender IDs in production.
- [ ] App Store + Play Store approval received (or scheduled for launch day).
- [ ] Public DNS prepared (low TTL on go-live day).
- [ ] Status page live.
- [ ] Runbooks reviewed by on-call team.
- [ ] Training videos uploaded for branch staff.
- [ ] Customer privacy policy + ToS published.

### 3.2 Cutover Window

- Scheduled: **Sunday 02:00–05:00 Asia/Riyadh** (lowest order volume window).
- Comms: customer email + SMS day prior; app banner.

### 3.3 Cutover Steps

| Step | Owner | Duration |
|---|---|---|
| Take snapshots (Mongo, S3) | DevOps | 5 min |
| Freeze writes (maintenance mode) | DevOps | — |
| Apply final migrations | Backend lead | 10 min |
| Switch DNS to prod LB | DevOps | 5 min (TTL 60s) |
| Roll new releases (api, web, admin, kds) via ArgoCD | DevOps | 15 min |
| Roll POS update to all branches (staged 5%→100%) | POS lead | 60 min |
| Smoke test (login, place order, pay, track, refund) | QA | 30 min |
| Unfreeze writes | DevOps | — |
| Monitor for 1h hyper-care | All hands | 60 min |
| Send "we're live" announcement | Marketing | — |

### 3.4 Rollback Plan

Each step has a rollback action:
- DNS: TTL 60s → flip back instantly.
- API/web/admin/kds: ArgoCD `rollback` to previous tag.
- POS: previous installer pinned per branch via update channel; cashiers can keep operating on old version (offline-capable).
- Mongo: PITR restore (RPO 5 min) if schema migration corruption.
- ZATCA: enter degraded mode (queue invoices, surface manual reconciliation report).

Rollback decision rights: SEV1 → on-call commander; SEV2 → product + tech leads jointly.

### 3.5 Communication Tree

- War-room Slack channel `#mv-golive`.
- Bridge call open T-30 to T+2h.
- Status page updated every 30 min.
- Customer comms via app banner + push if any user-facing impact.

---

## 4. Hypercare (T+0 to T+14 days)

- 24/7 on-call rotation by Codlight (primary + secondary).
- Daily 09:30 standup with Manhattan Vibes ops.
- Daily KPI report: order volume, success rate, NPS sample, defects.
- Faster SLA: SEV2 fix within 12h; SEV3 within 3 days.
- Feature freeze except critical fixes.
- Exit criteria: ≥7 consecutive days with 0 SEV1/SEV2 and SLOs met.

---

## 5. Post-Go-Live (Stabilization)

- Weekly retros for first 6 weeks.
- Backlog grooming for known-defect cleanup.
- Operational runbooks polished from real incidents.
- Customer feedback loop established (NPS, support tickets, app reviews).
- Begin Phase-2 planning per roadmap.

---

## 6. Training Plan

| Audience | Format | Duration | Materials |
|---|---|---|---|
| Cashiers | On-site + video | 1 day | POS quick-reference card, common-flow cheatsheet |
| Branch Managers | On-site + portal walk-through | 2 days | Refund/shift/inventory playbook |
| Drivers | App walkthrough | 2h | Job acceptance + POD videos |
| Marketing | Portal demo | 1 day | Segmentation + campaign playbook |
| Finance | Portal + ZATCA demo | 1 day | VAT report walkthrough |
| Customers | In-app onboarding | self-serve | Help center articles |

Train-the-trainer for new-branch expansion.

---

## 7. Acceptance Document

A formal "Go-Live Acceptance" PDF is produced at T+14 capturing:
- All UAT scripts and sign-offs.
- Cutover log.
- Hypercare incident summary.
- KPIs met.
- Open items + ownership.
- Joint sign-off (Manhattan Vibes CEO + Codlight CEO).
