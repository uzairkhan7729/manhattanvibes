# 05 — Database Design (ERD + MongoDB Schema)

> Single MongoDB cluster, multi-branch via `branchId` row-level tenancy. Money stored in **halalas** (integer SAR/100). All timestamps UTC ISO-8601 via Mongoose getters.

## 1. Entity Relationship Diagram (logical)

```
                            ┌──────────┐
                            │  Tenant  │  (Manhattan Vibes; singleton for now)
                            └────┬─────┘
                                 │ 1..*
                            ┌────▼─────┐
                            │  Branch  │
                            └────┬─────┘
                                 │
        ┌─────────────────┬──────┴──────────┬──────────────────┐
        │                 │                 │                  │
   ┌────▼────┐      ┌─────▼─────┐    ┌──────▼─────┐    ┌──────▼─────┐
   │Employee │      │Inventory  │    │  Table     │    │ Driver     │
   └─────────┘      │ Item Stock│    └────────────┘    └──────┬─────┘
                    └─────┬─────┘                             │
                          │                                   │
                          │ many:many (Recipe)                │
                          │                                   │
                   ┌──────▼──────┐                            │
                   │   Product   │                            │
                   └──────┬──────┘                            │
                          │  many:1                           │
                   ┌──────▼──────┐                            │
                   │  Category   │                            │
                   └─────────────┘                            │
                                                              │
   ┌──────────┐    ┌────────┐     ┌──────────┐         ┌─────▼─────┐
   │ Customer │───►│ Order  │────►│ Payment  │         │ Delivery  │
   └────┬─────┘ 1:N└───┬────┘ 1:N └──────────┘         │  Job      │
        │              │                               └─────┬─────┘
        │              │ 1:N                                 │ 1:1
        │         ┌────▼─────┐                               │
        │         │OrderItem │                               │
        │         └──────────┘                               │
        │ 1:N                                                │
   ┌────▼──────────┐     ┌──────────────┐                    │
   │LoyaltyAccount │     │ AuditLog     │                    │
   │ + Ledger      │     └──────────────┘                    │
   └───────────────┘                                         │
                                                             │
   ┌──────────────┐      ┌──────────────┐                    │
   │ Coupon       │      │ Campaign     │                    │
   └──────────────┘      └──────────────┘                    │
                                                       Order─┘
```

## 2. Collections — Mongoose Schemas

All collections include:
- `_id: ObjectId`
- `tenantId: ObjectId` (indexed)
- `branchId?: ObjectId` (when scoped)
- `createdAt`, `updatedAt` (auto via Mongoose timestamps)
- `version: number` (optimistic concurrency)
- `deletedAt?: Date` (soft delete)

### 2.1 `users` (staff + customers)

```ts
{
  _id, tenantId,
  type: 'customer' | 'staff',                       // discriminates
  email?: string,
  phone: { countryCode: string, number: string },    // E.164 normalized
  passwordHash?: string,                             // staff only (customers OTP-first)
  emailVerified: boolean,
  phoneVerified: boolean,
  fullName: { ar?: string, en: string },
  dob?: Date,                                        // for birthday rewards
  gender?: 'M' | 'F' | 'X',
  preferredLanguage: 'ar' | 'en',
  // staff-only
  role?: Role,
  branchIds?: ObjectId[],                            // staff can be assigned to multiple branches
  employmentId?: string,
  // customer-only
  loyaltyAccountId?: ObjectId,
  addresses?: Address[],
  marketingPrefs?: { sms: boolean, email: boolean, push: boolean, whatsapp: boolean },
  // common
  lastLoginAt?: Date,
  mfa?: { enabled: boolean, secret?: string },       // staff
  status: 'active' | 'suspended' | 'deleted',
}
```

**Indexes:**
```
{ tenantId: 1, email: 1 }         unique sparse
{ tenantId: 1, 'phone.number': 1 } unique sparse
{ tenantId: 1, type: 1, status: 1 }
{ tenantId: 1, branchIds: 1 }     for staff lookups
```

### 2.2 `customers_addresses` (embedded in user.addresses)

```ts
Address = {
  _id, label: string, line1: string, line2?: string,
  city: string, district: string, country: 'SA',
  lat: number, lng: number,
  isDefault: boolean,
  zoneId?: ObjectId,                                  // resolved at save time
  instructions?: string
}
```

### 2.3 `roles_permissions` (seed-only; rarely changes)

```ts
{ _id, role: Role, permissions: string[] }
```

### 2.4 `branches`

```ts
{
  _id, tenantId,
  code: string,                                       // 'RUH-1' (used as order prefix)
  name: { ar, en },
  address: Address,
  geofence: GeoJSON.Polygon,                          // 2dsphere indexed
  deliveryZones: Array<{ name, polygon: GeoJSON.Polygon, minOrder, deliveryFee, etaMinutes }>,
  openingHours: Array<{ day: 0..6, open: 'HH:mm', close: 'HH:mm' }>,
  contact: { phone, email },
  taxId: string,                                      // ZATCA TIN
  zatcaSerialPrefix: string,
  features: { dineIn: boolean, pickup: boolean, delivery: boolean, takeaway: boolean },
  status: 'active' | 'paused' | 'closed',
  managerUserId?: ObjectId,
}
```

**Indexes:**
```
{ tenantId: 1, code: 1 } unique
{ tenantId: 1, status: 1 }
{ geofence: '2dsphere' }
{ 'deliveryZones.polygon': '2dsphere' }
```

### 2.5 `categories`

```ts
{ _id, tenantId, parentId?, name: {ar,en}, slug, image, displayOrder, isActive }
```

Index: `{ tenantId: 1, parentId: 1, displayOrder: 1 }`

### 2.6 `products`

```ts
{
  _id, tenantId,
  sku: string,
  categoryId: ObjectId,
  name: { ar, en },
  description: { ar, en },
  images: [{ url, alt: {ar,en} }],
  type: 'simple' | 'configurable' | 'combo',
  // simple price
  basePrice: number,                                  // halalas
  // configurable (pizza)
  sizes?: Array<{ code: 'S'|'M'|'L'|'XL', priceDelta: number, maxToppings: number }>,
  crusts?: Array<{ code, name:{ar,en}, priceDelta: number }>,
  sauces?: ObjectId[],                                // ref Topping
  toppings?: ObjectId[],                              // ref Topping
  // combo
  components?: Array<{ productId: ObjectId, qty: number, swappableWith?: ObjectId[] }>,
  // global flags
  isVeg: boolean, allergens: string[], spicyLevel: 0..3,
  nutrition?: { calories, protein, carbs, fat, sodium },
  vatRate: number,                                    // default 15
  isActive: boolean,
  // per-branch overrides
  branchOverrides?: Map<branchId, { price?: number, isActive?: boolean, isAvailable?: boolean }>,
}
```

Index: `{ tenantId: 1, sku: 1 } unique`, `{ tenantId: 1, categoryId: 1, isActive: 1 }`, text index on `name.en`, `name.ar`.

### 2.7 `toppings` (sauces + cheeses + meats etc.)

```ts
{ _id, tenantId, name: {ar,en}, category: 'sauce'|'cheese'|'meat'|'veg', basePrice: number, image, recipeIngredients: [{ ingredientId, qty }] }
```

### 2.8 `orders`

```ts
{
  _id, tenantId, branchId,
  orderNumber: string,                                // 'RUH-1-000123'
  channel: 'pos' | 'web' | 'mobile' | 'phone' | 'aggregator',
  type: 'dinein' | 'takeaway' | 'delivery' | 'pickup',
  customerId?: ObjectId,
  guestInfo?: { name, phone },                        // for non-registered POS customers
  tableId?: ObjectId,                                 // dinein only
  state: OrderState,                                  // see SDD §4
  items: Array<{
    _id, productId, productSnapshot: {...},          // snapshot for pricing audit
    qty: number,
    sizeCode?, crustCode?,
    modifiers: Array<{ type: 'sauce'|'cheese'|'topping'|'addon', toppingId?, productId?, qty, unitPrice }>,
    unitPrice: number,                                // halalas
    lineTotal: number,                                // halalas
    notes?: string,
    state?: 'pending'|'preparing'|'ready'|'served'    // KDS line-state when station-split
  }>,
  pricing: {
    subtotal: number,
    discountTotal: number,
    discountBreakdown: Array<{ source: 'coupon'|'loyalty'|'manual', amount, ref? }>,
    deliveryFee: number,
    vatRate: number,
    vat: number,
    tip: number,
    total: number,                                    // halalas
  },
  payments: ObjectId[],                               // ref payments
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'refunded' | 'failed',
  delivery?: {
    addressId, addressSnapshot, zoneId, driverId?, etaSeconds,
    pickedUpAt?, deliveredAt?,
    proofOfDelivery?: { kind: 'signature'|'photo'|'otp', value }
  },
  invoice?: {
    zatcaUuid: string,
    invoiceHash: string,
    qrPayload: string,                                // base64
    pdfUrl: string,
    clearedAt: Date,
  },
  notes?: string,
  promoCodes: string[],
  loyalty?: { earnedPoints: number, redeemedPoints: number, accrualHoldUntil?: Date },
  audit: {
    createdBy?: ObjectId, createdByRole, deviceId?,
    transitions: Array<{ from, to, by, ts, reason? }>
  },
  // sync
  clientOpId?: string,                                // POS offline reconciliation key
  syncedAt?: Date,
}
```

**Indexes:**
```
{ tenantId: 1, branchId: 1, orderNumber: 1 } unique
{ tenantId: 1, branchId: 1, state: 1, createdAt: -1 }   // KDS query
{ tenantId: 1, customerId: 1, createdAt: -1 }            // customer history
{ 'delivery.driverId': 1, state: 1 }                     // driver app
{ clientOpId: 1, branchId: 1 } unique sparse             // idempotency
{ tenantId: 1, createdAt: -1 }                           // reports
```

### 2.9 `payments`

```ts
{
  _id, tenantId, branchId, orderId,
  method: 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay' | 'wallet' | 'loyalty',
  amount: number,                                     // halalas
  currency: 'SAR',
  status: 'authorized' | 'captured' | 'failed' | 'voided' | 'refunded' | 'partial-refunded',
  gateway?: 'hyperpay' | 'moyasar' | 'checkout' | 'stcpay-native',
  gatewayRefs: { txnId?, authCode?, last4?, brand?, threeDS?, raw? },
  refunds: Array<{ amount, reason, refundedAt, byUserId, gatewayRefundId }>,
  capturedAt?: Date,
}
```

Index: `{ orderId: 1 }`, `{ 'gatewayRefs.txnId': 1 }`.

### 2.10 `loyalty_accounts` + `loyalty_ledger`

```ts
// loyalty_accounts
{ _id, tenantId, customerId, tier: 'bronze'|'silver'|'gold'|'platinum',
  pointsBalance: number, lifetimeSpendHalalas: number,
  tierUpgradedAt?, tierExpiresAt?, status }

// loyalty_ledger (append-only)
{ _id, tenantId, customerId, accountId, type: 'earn'|'redeem'|'expire'|'adjust'|'birthday'|'referral',
  points: number,                                     // signed
  orderId?, campaignId?, ref?, ts, byUserId? }
```

Indexes: `{ tenantId: 1, customerId: 1 }` unique on accounts; `{ accountId: 1, ts: -1 }` on ledger.

### 2.11 `coupons` & `promotions`

```ts
// coupons
{ _id, tenantId, code: string, kind: 'percent'|'flat'|'freeItem'|'freeDelivery',
  value: number, // % or halalas
  minOrder?, maxDiscount?, productScope?: ObjectId[], categoryScope?: ObjectId[],
  channels?: ('pos'|'web'|'mobile')[], branchIds?: ObjectId[],
  validFrom, validTo, daysOfWeek?, hoursOfDay?,
  usageLimit?: number, perCustomerLimit?: number,
  usedCount: number, firstOrderOnly: boolean, stackableWithLoyalty: boolean,
  isActive: boolean }

// promotions (always-on rule-based, distinct from coupons)
{ _id, tenantId, name, type: 'BOGO'|'bundle'|'tieredDiscount',
  rule: <json-logic>, reward: <json>, validFrom, validTo, branchIds?, channels?, isActive }
```

Indexes: `{ tenantId: 1, code: 1 } unique` (coupons).

### 2.12 `inventory_items` + `inventory_stock` + `recipes` + `purchase_orders` + `goods_receipts` + `waste_logs`

```ts
// inventory_items
{ _id, tenantId, name: {ar,en}, sku, unit: 'kg'|'g'|'L'|'ml'|'pcs',
  unitCost: number, vendorIds: ObjectId[], reorderLevel: number, isActive }

// inventory_stock  (per branch)
{ _id, tenantId, branchId, itemId, qtyOnHand: number, qtyReserved: number,
  lastCountAt?, updatedAt }

// recipes  (productId → ingredients)
{ _id, tenantId, productId, items: [{ itemId, qty, unit }] }

// purchase_orders
{ _id, tenantId, branchId, vendorId, lines: [{ itemId, qty, unitCost }],
  status: 'draft'|'sent'|'received'|'cancelled', expectedDate, totalCost }

// goods_receipts
{ _id, tenantId, branchId, poId, lines: [{ itemId, qtyReceived, batchNo?, expiry? }], receivedAt, byUserId }

// waste_logs
{ _id, tenantId, branchId, itemId, qty, reason, byUserId, ts }
```

### 2.13 `tables`

```ts
{ _id, tenantId, branchId, code: 'T-12', seats: number, section?: string, status: 'free'|'occupied'|'reserved'|'cleaning', currentOrderId? }
```

### 2.14 `drivers`

```ts
{ _id, tenantId, branchId, userId, vehicle: { plate, type, color },
  licenseNo, status: 'available'|'onJob'|'offline', lastLocation: GeoJSON.Point, lastSeenAt }
```

Index: `{ lastLocation: '2dsphere' }`.

### 2.15 `delivery_jobs`

```ts
{ _id, tenantId, branchId, orderId, driverId?, route: GeoJSON.LineString,
  status: 'queued'|'assigned'|'picked'|'enroute'|'delivered'|'failed',
  assignedAt?, pickedAt?, deliveredAt?, attemptCount, etaSeconds }
```

### 2.16 `audit_logs`

```ts
{ _id, tenantId, ts, actor:{userId,role,ip,ua}, action, target:{type,id,branchId?}, before, after, requestId }
```

Sharded by `{ts: 1}` (capped per-day partition collection if scale demands).

### 2.17 `notifications` & `notification_templates`

```ts
// templates
{ _id, tenantId, key, channel: 'push'|'sms'|'email'|'whatsapp',
  locale: 'ar'|'en', subject?, body, vars: string[] }

// notifications (outbox)
{ _id, tenantId, channel, recipient, templateKey, vars, status: 'queued'|'sent'|'failed', providerRef?, error?, ts }
```

### 2.18 `sync_outbox` (server-side)

```ts
{ _id, tenantId, branchId, deviceId, event, payload, sequence, deliveredAt?, ackBy }
```

### 2.19 `refresh_tokens`

```ts
{ _id, tenantId, userId, jti, hashedToken, deviceId, userAgent, ip, family,
  issuedAt, expiresAt, revokedAt? }
```

Index: `{ jti: 1 }`, `{ userId: 1, family: 1 }`, TTL on `expiresAt`.

### 2.20 `idempotency_keys`

Stored in Redis (24h TTL) — not a Mongo collection.

## 3. Aggregation Strategy

Reports use the **MongoDB Aggregation Framework** with `$facet` for multi-pivot, `$merge` for materialized daily snapshots.

**Daily sales rollup** (run hourly via worker):

```js
db.orders.aggregate([
  { $match: { paymentStatus: 'paid', closedAt: { $gte: today, $lt: tomorrow }}},
  { $group: {
      _id: { branchId: '$branchId', channel: '$channel' },
      orders: { $sum: 1 },
      grossSales: { $sum: '$pricing.subtotal' },
      discount: { $sum: '$pricing.discountTotal' },
      vat: { $sum: '$pricing.vat' },
      net: { $sum: '$pricing.total' }
  }},
  { $merge: { into: 'rollup_daily_sales', whenMatched: 'replace' } }
]);
```

For heavy BI (LTV cohorts, profitability), Phase-2 ETL exports to PostgreSQL / BigQuery — see [22-SCALABILITY-ROADMAP.md](22-SCALABILITY-ROADMAP.md).

## 4. Index Strategy (summary)

| Collection | Hot Indexes |
|---|---|
| orders | `(branchId, state, createdAt)` — KDS;  `(customerId, createdAt)` — history;  `(clientOpId)` — sync;  `(createdAt)` — reports |
| products | `(categoryId, isActive)`, `text(name)` |
| customers | `(phone)`, `(email)` |
| inventory_stock | `(branchId, itemId)` |
| audit_logs | `(actor.userId, ts)`, `(target.id, ts)`, partial date partitioning |
| drivers | `2dsphere(lastLocation)` |

All compound indexes lead with `tenantId` (or `branchId` when tenant-scoped queries always include it) to support cluster-level shard isolation if we shard later on `tenantId`.

## 5. Data Retention

| Data | Retention |
|---|---|
| Orders | 7 years (KSA tax law) |
| Payments | 7 years |
| Audit logs | 13 months online; archive S3 Glacier 7y |
| Notifications outbox | 90 days |
| Refresh tokens | until expiry + 30 days then purge |
| Customer PII | per consent; right-to-delete pipeline |

## 6. Migration Tooling

`mongo-migrate-ts`. Each migration:
- Forward-only.
- Idempotent.
- Versioned in repo (`apps/api/migrations/*.ts`).
- CI gate: `--dry-run` on staging before prod apply.

## 7. Sample Mongoose Models (excerpt)

See `docs/schemas/` for full TypeScript model files:
- `docs/schemas/order.model.ts`
- `docs/schemas/product.model.ts`
- `docs/schemas/user.model.ts`
- (others stubbed; full set delivered with code repo)
