# 14 — Loyalty & CRM

## Part A — Loyalty System (Module 6)

### A.1 Domain Model

- **LoyaltyAccount** — one per customer. Holds `pointsBalance`, `tier`, `lifetimeSpend`.
- **LoyaltyLedger** — append-only journal of `earn / redeem / expire / adjust / birthday / referral`.

Points balance is always derived from `SUM(ledger.points)`; the cached `pointsBalance` on the account is for query speed and is reconciled nightly.

### A.2 Earning Rules

- Base rate: 1 SAR spend → 1 point (configurable per tier).
- Earn only on **paid** orders (post tax, post discount, pre tip).
- Refunds reverse earned points proportionally.
- Tier multipliers: Bronze 1×, Silver 1.25×, Gold 1.5×, Platinum 2×.
- Bonus campaigns: "Double points on Mondays" via promo rule engine.

Hold window: points enter `accrualHoldUntil = order.deliveredAt + 24h` to prevent redemption while a return may still happen. Visible as "Pending" in app.

### A.3 Redemption

- Conversion: 100 points = 1 SAR off (configurable).
- Slider in checkout snaps to 100 increments.
- Cannot redeem more than 50% of order subtotal (configurable per tier — Platinum 100%).
- Stacking with coupons: allowed by default; toggle per coupon.

### A.4 Tiers

| Tier | Threshold (lifetime spend, rolling 12 months) | Multiplier | Perks |
|---|---|---|---|
| Bronze | 0 | 1.0× | Basic rewards |
| Silver | 1,500 SAR | 1.25× | Free delivery >75 SAR |
| Gold | 4,000 SAR | 1.5× | Free delivery any, birthday meal |
| Platinum | 10,000 SAR | 2.0× | Priority kitchen, dedicated support |

- Tier evaluated on each order completion and once daily.
- Upgrade: immediate.
- Downgrade: end-of-month evaluation; communicate 14 days in advance.

### A.5 Birthday Reward

- Cron job 7 days before customer's DOB issues a coupon (e.g., "free dessert with order >50 SAR").
- One per year per customer.

### A.6 Referral Program

- Each customer has a referral code (`MV-AHMED-1234`).
- Referee redeems on signup → both get 50 points credited on referee's **first paid order** ≥ 50 SAR.
- Anti-abuse: same payment method or device-id → blocked; self-referral blocked.

### A.7 Expiry

- Points expire 12 months after **last earn activity** (rolling — any earn resets the clock).
- 30-day-out reminder push notification.
- Expiration ledger entry on the expiry date.

### A.8 APIs

See [06-API-SPECIFICATION.md §7](06-API-SPECIFICATION.md).

### A.9 Edge Cases

- Order cancelled pre-pay → no points.
- Partial refund → proportional points reversal (rounded down).
- Customer deletes account → balance forfeited after grace (per ToS).
- Adjustments by admin require reason + audit log.

---

## Part B — CRM (Module 7)

### B.1 Customer Segmentation

Segment = saved query against `customers + orders + loyalty`. Predicates:

- demographic (age range, gender, language)
- behavioral (orders in last N days, AOV, channel preference, last order recency, RFM bucket)
- geographic (city, district, branch affinity)
- loyalty (tier, points)
- consent (channel opt-ins)

Evaluated nightly into `segment_members` materialized list (also recomputable on demand for small segments).

Sample segments:
- "VIPs at risk" — Platinum & no order in 30 days
- "Pickup lovers" — >60% pickup share, last 90 days
- "New mums" — based on order patterns + opt-in survey
- "Ramadan iftar prospects" — historical Ramadan orderers

### B.2 Campaigns

A campaign ties: **segment + channel + template + schedule + KPI**.

Channels: push, SMS, email, WhatsApp.

Workflow:
1. Marketing draft → preview cost (SMS price × estimated reach).
2. Get approval (manager+).
3. Schedule send.
4. Worker fans out via NotificationService respecting per-customer rate limits and opt-ins.
5. Track delivery, opens (email), clicks (deep links).

### B.3 Customer 360 View

In admin portal (`/customers/:id`):
- Identity: name, phone, email, language, addresses
- Activity: orders timeline, AOV trend, last 10 orders
- Loyalty: tier, balance, ledger
- Engagement: campaigns received, opened, clicked
- Support tickets / complaints
- Consent ledger
- PDPL controls (export, anonymize)

### B.4 Purchase Trends & Reports

- RFM (Recency, Frequency, Monetary) scoring nightly.
- Cohort analysis (signups by month, retention by month-since-signup).
- Channel mix per cohort.
- Funnel: visit → add to cart → checkout start → checkout success.
- LTV by acquisition source.

### B.5 Marketing Templates

- Liquid-like variable substitution: `{{firstName}}`, `{{points}}`, `{{lastBranch}}`.
- Locale-aware (AR/EN).
- Approvals workflow: draft → review → live; version history.

### B.6 Compliance

- KSA PDPL: explicit opt-in for marketing; per-channel granular.
- Unsubscribe links in email; STOP keyword on SMS; opt-out per push channel.
- Quiet hours: no SMS between 22:00–08:00 unless transactional.
- Frequency cap: max 2 marketing messages per customer per week (configurable).
- Suppression list global.
