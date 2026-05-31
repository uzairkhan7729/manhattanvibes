# 06 — API Specification

> Base URL: `https://api.manhattanvibes.sa/api/v1` — versioned URI. Full OpenAPI 3.1 doc generated from Zod schemas at `/openapi.json`. Below is the canonical catalog grouped by domain. All responses RFC 7807 on error.

## 0. Conventions

- `Authorization: Bearer <jwt>` for protected routes.
- `Idempotency-Key: <uuid>` on all POST mutations (24h replay window).
- `Accept-Language: ar | en` (default `ar`).
- `X-Branch-Id: <id>` required for branch-scoped operations when actor is multi-branch staff.
- Pagination: `?cursor=...&limit=50` (max 200). Response includes `nextCursor`.
- Currency in halalas (integer SAR/100). Times ISO-8601 UTC.

## 1. Auth (`/auth`)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/auth/register` | Customer self-registration (email + phone + password OR phone-only OTP-bootstrap) | public |
| POST | `/auth/login` | Email/phone + password | public |
| POST | `/auth/otp/request` | Send OTP to phone | public, rate-limited 3/min |
| POST | `/auth/otp/verify` | Verify OTP, issue tokens | public |
| POST | `/auth/refresh` | Rotate refresh + issue new access | refresh token |
| POST | `/auth/logout` | Revoke current refresh token | bearer |
| POST | `/auth/logout-all` | Revoke entire device family | bearer |
| POST | `/auth/password/forgot` | Send reset link/OTP | public |
| POST | `/auth/password/reset` | Reset with token | public |
| POST | `/auth/social/google` | Google OAuth code → tokens | public |
| POST | `/auth/social/apple` | Apple Sign-In identityToken → tokens | public |
| POST | `/auth/mfa/enroll` | Enroll TOTP | bearer |
| POST | `/auth/mfa/verify` | Verify TOTP at login | public-with-mfa-challenge |
| GET  | `/auth/me` | Current user + permissions | bearer |

**Sample — POST /auth/login**
```json
// request
{ "identifier": "+966555000000", "password": "P@ssw0rd!2026" }
// response 200
{
  "accessToken":  "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn":    900,
  "user": { "id":"...", "fullName":"...", "role":"Customer" }
}
```

## 2. Customers (`/customers`)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET   | `/customers` | List (admin/marketing) | RBAC `customers:read` |
| GET   | `/customers/:id` | Get | self or admin |
| PATCH | `/customers/:id` | Update profile | self or admin |
| GET   | `/customers/:id/orders` | Order history | self or admin |
| GET   | `/customers/:id/addresses` | List addresses | self |
| POST  | `/customers/:id/addresses` | Add | self |
| PATCH | `/customers/:id/addresses/:addrId` | Update | self |
| DELETE| `/customers/:id/addresses/:addrId` | Delete | self |
| POST  | `/customers/:id/marketing-prefs` | Update opt-ins | self |
| POST  | `/customers/:id/anonymize` | GDPR/PDPL right-to-delete pipeline | admin |
| GET   | `/customers/segments` | List segments | marketing |
| POST  | `/customers/segments` | Create segment | marketing |

## 3. Catalog (`/categories`, `/products`, `/toppings`)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET   | `/categories` | Tree | public |
| POST  | `/categories` | Create | admin |
| PATCH | `/categories/:id` | Update | admin |
| DELETE| `/categories/:id` | Soft delete | admin |
| GET   | `/products?branchId=&categoryId=&search=` | List (branch-aware pricing) | public |
| GET   | `/products/:id?branchId=` | Detail | public |
| POST  | `/products` | Create | admin |
| PATCH | `/products/:id` | Update | admin |
| DELETE| `/products/:id` | Soft delete | admin |
| POST  | `/products/:id/branch-override` | Set per-branch overrides | branch manager / admin |
| POST  | `/products/:id/availability` | 86 an item (branch-level) | branch staff |
| GET   | `/toppings` | List | public |
| POST  | `/toppings` | Create | admin |

## 4. Orders (`/orders`)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST  | `/orders/quote` | Price a draft cart (apply promos, loyalty, VAT) without persisting | customer or staff |
| POST  | `/orders` | Place order | customer or staff |
| GET   | `/orders/:id` | Read | self / branch staff |
| GET   | `/orders?branchId=&state=&from=&to=` | Search | branch staff / admin |
| PATCH | `/orders/:id` | Modify pre-kitchen-accept | branch staff / customer (limited) |
| POST  | `/orders/:id/transition` | Advance state (e.g., kitchen accept, bump, ready) | role-gated |
| POST  | `/orders/:id/cancel` | Cancel with reason | branch staff (manager if past kitchen accept) |
| POST  | `/orders/:id/refund` | Initiate refund | manager+ |
| POST  | `/orders/:id/print-receipt` | Print/resend receipt | branch staff |
| GET   | `/orders/:id/tracking` | Public tracking (token-gated) | order-token |
| POST  | `/orders/:id/feedback` | Customer feedback | self |

**Sample — POST /orders**
```json
{
  "branchId": "...",
  "type": "delivery",
  "channel": "mobile",
  "items": [
    { "productId":"P_001","qty":1,"sizeCode":"L","crustCode":"thin",
      "modifiers":[{ "type":"topping","toppingId":"T_05","qty":1 }]
    }
  ],
  "addressId": "...",
  "promoCode": "RAMADAN20",
  "loyaltyPoints": 200,
  "payment": { "method": "applepay", "token": "..." }
}
```

## 5. Tables (`/tables`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/tables?branchId=` | List | 
| POST  | `/tables` | Create |
| PATCH | `/tables/:id` | Update |
| POST  | `/tables/:id/assign` | Assign order |
| POST  | `/tables/merge` | Merge two/more |
| POST  | `/tables/:id/split` | Split bill |
| POST  | `/tables/:id/transfer` | Transfer to another table/section |

## 6. Payments (`/payments`)

| Method | Path | Purpose |
|---|---|---|
| POST  | `/payments/intent` | Create payment intent (3DS prepared) |
| POST  | `/payments/:id/capture` | Capture (if delayed) |
| POST  | `/payments/:id/refund` | Refund |
| POST  | `/payments/webhook/:gateway` | Inbound webhook (HyperPay, Moyasar, STC Pay) — HMAC verified |
| GET   | `/payments/:id` | Read |

## 7. Loyalty (`/loyalty`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/loyalty/me` | Account (balance, tier, expiry) |
| GET   | `/loyalty/:customerId` | (admin) |
| POST  | `/loyalty/:customerId/adjust` | Manual adjustment (admin, audited) |
| GET   | `/loyalty/:customerId/ledger` | Ledger |
| POST  | `/loyalty/redeem-quote` | Preview redemption value |
| GET   | `/loyalty/tiers` | Tier configuration |

## 8. Promotions & Coupons (`/coupons`, `/promotions`, `/campaigns`)

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/coupons` | CRUD |
| POST  | `/coupons/validate` | Validate code for a cart |
| GET/POST/PATCH/DELETE | `/promotions` | CRUD rule-based promos |
| GET/POST/PATCH/DELETE | `/campaigns` | Marketing campaigns (segments + templates) |
| POST  | `/campaigns/:id/launch` | Trigger send |

## 9. Inventory (`/inventory`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/inventory/items` | List |
| POST  | `/inventory/items` | Create |
| PATCH | `/inventory/items/:id` | Update |
| GET   | `/inventory/stock?branchId=` | Stock-on-hand |
| POST  | `/inventory/stock/count` | Count submission |
| POST  | `/inventory/stock/adjust` | Manual adjustment |
| POST  | `/inventory/waste` | Log waste |
| GET   | `/inventory/recipes` | List |
| POST  | `/inventory/recipes` | Create |
| GET   | `/inventory/po` | List purchase orders |
| POST  | `/inventory/po` | Create |
| POST  | `/inventory/po/:id/receive` | Goods receipt |

## 10. Branches & Employees (`/branches`, `/employees`)

| Method | Path | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/branches` | CRUD |
| GET   | `/branches/:id/hours` | Read open hours |
| PATCH | `/branches/:id/hours` | Update |
| GET   | `/branches/:id/zones` | Delivery zones |
| GET   | `/employees` | List |
| POST  | `/employees` | Create |
| PATCH | `/employees/:id` | Update |
| POST  | `/employees/:id/clock-in` | Shift start |
| POST  | `/employees/:id/clock-out` | Shift end |

## 11. Delivery (`/delivery`, `/drivers`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/drivers?branchId=` | List |
| POST  | `/drivers` | Create |
| PATCH | `/drivers/:id` | Update |
| POST  | `/drivers/:id/location` | Heartbeat GPS |
| POST  | `/delivery/jobs/:orderId/assign` | Assign driver |
| POST  | `/delivery/jobs/:orderId/pickup` | Mark picked |
| POST  | `/delivery/jobs/:orderId/delivered` | Mark delivered + POD |
| GET   | `/delivery/route?driverId=` | Optimized route |
| GET   | `/delivery/analytics?from=&to=&branchId=` | Metrics |

## 12. KDS (`/kds`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/kds/queue?branchId=&station=` | Snapshot of all incoming/preparing/ready |
| POST  | `/kds/bump/:orderId` | Move forward in pipeline |
| POST  | `/kds/bump/:orderId/:itemId` | Bump single line (station-level) |

## 13. Notifications (`/notifications`)

| Method | Path | Purpose |
|---|---|---|
| POST  | `/notifications/test` | Send a test (admin) |
| GET   | `/notifications/templates` | List |
| POST  | `/notifications/templates` | Create/update |
| POST  | `/notifications/devices` | Register push device token |
| DELETE| `/notifications/devices/:token` | Unregister |

## 14. Reports (`/reports`)

| Method | Path | Purpose |
|---|---|---|
| GET   | `/reports/sales/daily?branchId=&date=` | Z-report |
| GET   | `/reports/sales/range?from=&to=&groupBy=` | Sales aggregation |
| GET   | `/reports/inventory/variance?branchId=&date=` | Variance |
| GET   | `/reports/profit?from=&to=&branchId=` | P&L |
| GET   | `/reports/vat?from=&to=` | VAT return support |
| GET   | `/reports/cashier/:userId?date=` | Cashier reconciliation |
| POST  | `/reports/export` | Async export job (CSV/PDF) → job id |
| GET   | `/reports/export/:jobId` | Job status |

## 15. Sync (POS Offline) (`/sync`)

| Method | Path | Purpose |
|---|---|---|
| POST  | `/sync` | Batch upload offline operations from POS device |
| GET   | `/sync/changes?since=&deviceId=` | Pull catalog/customer/promo deltas |
| GET   | `/sync/snapshot?branchId=` | Full snapshot for cold-start of a POS device |

**Sample — POST /sync**
```json
{
  "deviceId": "POS-RUH-1-04",
  "ops": [
    { "clientOpId": "uuid-1", "ts": "2026-05-31T12:01:00Z", "op": "ORDER_CREATE", "payload": { ... } },
    { "clientOpId": "uuid-2", "ts": "2026-05-31T12:01:05Z", "op": "PAYMENT_CAPTURE", "payload": { ... } }
  ]
}
```

Response indicates each op's outcome: `applied | conflict | duplicate | invalid` with server's canonical ids.

## 16. Webhooks (outbound)

The platform can push events to merchant-configured webhook URLs. HMAC-SHA256 signed.

| Event | Payload |
|---|---|
| `order.created` | order id, summary |
| `order.state_changed` | id, from, to |
| `payment.captured` | order, payment |
| `inventory.low` | item, branch |
| `loyalty.tier_changed` | customer, from, to |

`POST /admin/webhooks` to manage endpoints.

## 17. Health & Meta

| Method | Path | Purpose |
|---|---|---|
| GET   | `/health/live` | Liveness |
| GET   | `/health/ready` | Readiness (Mongo + Redis + queue) |
| GET   | `/health/version` | Build metadata |
| GET   | `/health/min-versions` | Minimum client app versions |
| GET   | `/openapi.json` | OpenAPI 3.1 |

## 18. Standard Error Catalog

| HTTP | code | Meaning |
|---|---|---|
| 400 | `validation-error` | Zod failures, see `fields` |
| 401 | `unauthenticated` | missing/invalid bearer |
| 403 | `forbidden` | RBAC denial |
| 404 | `not-found` | — |
| 409 | `concurrent-modification` | optimistic-concurrency conflict |
| 409 | `state-transition-invalid` | bad order state move |
| 409 | `insufficient-stock` | — |
| 409 | `payment-declined` | gateway said no |
| 410 | `coupon-expired` | — |
| 422 | `idempotency-key-conflict` | replay with different body |
| 426 | `upgrade-required` | client below min version |
| 429 | `rate-limited` | with `Retry-After` |
| 451 | `outside-delivery-zone` | — |
| 500 | `internal-error` | — |
| 503 | `service-degraded` | dependency unhealthy |

## 19. Rate Limits (defaults; tuned per environment)

| Bucket | Limit |
|---|---|
| Anonymous IP | 60/min |
| Customer authenticated | 300/min |
| Staff authenticated | 1000/min |
| Auth OTP | 3/min/phone, 20/day/phone |
| Payment webhook | unlimited (HMAC-verified) |
