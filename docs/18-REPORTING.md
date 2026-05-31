# 18 — Reporting Module

> Phase 1 reports run on Mongo (aggregation framework + materialized rollups). Phase 2 introduces a PostgreSQL/BigQuery analytics warehouse for heavy BI (see [22-SCALABILITY-ROADMAP.md](22-SCALABILITY-ROADMAP.md)).

## 1. Report Catalog

### A. Sales Reports

| Report | Filters | Columns / Metrics |
|---|---|---|
| Daily Z-Report | branch, date | Opening float, gross sales, discounts, VAT, refunds, net, cash count, variance |
| Monthly Sales | branch(es), month | Total orders, gross, net, AOV, channel mix, top categories |
| Sales by Hour | branch, date range | Hourly buckets — for staffing decisions |
| Sales by Channel | range | POS/web/mobile/aggregator mix |
| Sales by Branch | range | Comparative |
| Cashier Reports | cashier, shift/date | Orders, sales, refunds, voids, cash collected, variance |
| Item Sales | range, branch | Per-product qty, revenue, contribution margin |

### B. Inventory Reports

| Report | Filters | Metrics |
|---|---|---|
| Stock-on-Hand | branch | Per-item qty, unit cost, value |
| Consumption | branch, range | Theoretical vs actual usage; variance |
| Waste | branch, range | By reason code |
| Vendor Performance | vendor, range | On-time %, price drift |
| Reorder | branch | Items at/below reorder level |

### C. Customer Reports

| Report | Metrics |
|---|---|
| Cohorts | Signups by month × retention by month-since-signup |
| RFM | Recency / Frequency / Monetary buckets |
| LTV | Lifetime value by acquisition source |
| Repeat Rate | % customers with ≥2 orders in 90/180/365d |
| Top Spenders | Top N customers by spend |

### D. Profit Reports

| Report | Notes |
|---|---|
| Profit per Product | sale price − recipe cost; gross margin |
| Profit per Branch | sales − COGS − labor (Phase 2: labor) |
| Promo ROI | discount cost vs incremental sales |

### E. Tax / VAT Reports (KSA)

| Report | Notes |
|---|---|
| VAT Output | sales VAT collected, per period, per rate |
| VAT Input | from POs (only if VAT-eligible) |
| ZATCA Submission Pack | XML + CSV bundle per period |

### F. Delivery Reports

| Report | Metrics |
|---|---|
| Driver Performance | deliveries, on-time %, avg time, rating |
| Branch Delivery KPIs | per-branch comparison |
| Late Order Analysis | reasons, hotspots (geo heatmap) |

## 2. Implementation Patterns

### 2.1 Materialized Rollups

Hourly worker computes `rollup_daily_sales`, `rollup_hourly_sales`, `rollup_item_sales`, `rollup_inventory_stock_snapshot`. Reports read primarily from rollups; fall back to raw on miss.

### 2.2 Real-time Cards (Dashboard)

Dashboard live cards driven by Redis counters incremented on event consumption: `mv:dash:{branchId}:{date}:ordersCount`, `:sales`, etc. Counters reconciled with rollup at hour boundaries to correct drift.

### 2.3 Heavy Reports — Async

Reports > 50k rows or > 2s wall time run as async jobs:

```
POST /reports/export { type, filters, format } → 202 { jobId }
GET  /reports/export/:jobId → { status, downloadUrl? }
```

Worker writes to S3 (signed URL TTL 1h); admin UI polls or receives Socket.IO `export.ready`.

### 2.4 Scheduled Delivery

Reports can be subscribed to (per role, branch, format). Cron worker generates and emails/Slacks them daily / weekly / monthly.

## 3. Data Definitions

To avoid metric drift, every metric is centrally defined in `apps/api/src/modules/reports/metrics.ts`:

```ts
export const metrics = {
  grossSales:  (orders) => sum(o => o.pricing.subtotal),
  discount:    (orders) => sum(o => o.pricing.discountTotal),
  vat:         (orders) => sum(o => o.pricing.vat),
  net:         (orders) => sum(o => o.pricing.total - o.pricing.vat),  // pre-VAT net
  refunds:     (orders) => sum over Payment.refunds,
  // ...
};
```

Same definitions used by API, admin UI cards, and exports — no spreadsheets re-implementing math.

## 4. Currency, Tax, Rounding

- Stored in halalas (integer).
- Display: SAR with 2 decimals, AR/EN locale-aware separators.
- Rounding: per ZATCA — VAT calculated per invoice (not per line); banker's rounding (`round-half-even`) at halala precision.
- Time zone: all rollups bucketed in Asia/Riyadh (KSA business day = 00:00–23:59 Riyadh).

## 5. ZATCA Submission Pack

Monthly job assembles:
- Invoice XMLs cleared in period.
- Summary CSV per branch.
- Reconciliation: total invoiced vs total reported.
- Signed manifest with hash of pack.

Stored in S3 with retention 7y; downloadable from admin "VAT" section.

## 6. Performance Budgets

| Report | Target | Notes |
|---|---|---|
| Dashboard load | <1.5s | rollups + redis counters |
| Daily Z | <1.0s | one rollup row + payments query |
| Monthly sales | <3.0s | rollup aggregate |
| Item sales (large range) | async export | guard with limit |

## 7. Reporting Indexes (DB)

(See [05-DATABASE-DESIGN.md §4](05-DATABASE-DESIGN.md))

Special indexes for reports:
```
orders:   { tenantId: 1, paymentStatus: 1, closedAt: -1 }
orders:   { tenantId: 1, branchId: 1, closedAt: -1 }
payments: { capturedAt: -1 }
audit:    { ts: -1 }
```

## 8. Exports

- CSV (RFC 4180), UTF-8 with BOM (Excel-friendly).
- Excel (.xlsx) via `exceljs` — multi-sheet for complex reports.
- PDF (Z-reports, VAT statements, invoices) via headless Chromium (Playwright) rendering HTML templates → PDF.

## 9. Access Control

- Reports scoped by role + branch.
- Finance role: all financial reports across all branches.
- Branch manager: only own branch.
- Marketing: customer/CRM reports only; financials hidden.
- Every export downloaded is audit-logged with actor, filters, file hash.

## 10. Examples (illustrative aggregations)

### Daily Z by branch
```js
db.orders.aggregate([
  { $match: { branchId, paymentStatus: 'paid', closedAt: { $gte: dayStart, $lt: dayEnd } } },
  { $group: {
      _id: null,
      orders: { $sum: 1 },
      gross:  { $sum: '$pricing.subtotal' },
      disc:   { $sum: '$pricing.discountTotal' },
      vat:    { $sum: '$pricing.vat' },
      net:    { $sum: { $subtract: ['$pricing.total', '$pricing.vat'] } },
      delivery:{ $sum: '$pricing.deliveryFee' },
  }}
]);
```

### Item sales (top N)
```js
db.orders.aggregate([
  { $match: { branchId, closedAt: { $gte: start, $lt: end } } },
  { $unwind: '$items' },
  { $group: { _id: '$items.productId', qty: { $sum: '$items.qty' }, rev: { $sum: '$items.lineTotal' } } },
  { $sort: { rev: -1 } },
  { $limit: 20 },
  { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
]);
```
