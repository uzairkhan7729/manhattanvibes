# 15 — Inventory & Delivery Management

## Part A — Inventory (Module 9)

### A.1 Goals

- Real-time per-branch stock visibility.
- Auto-decrement on order completion (via recipe).
- Variance & waste tracking.
- Reorder discipline (vendor management, POs, goods receipt).

### A.2 Domain Model (refer to [05-DATABASE-DESIGN.md](05-DATABASE-DESIGN.md) for full schemas)

| Entity | Purpose |
|---|---|
| `InventoryItem` | Ingredient master (cheese, dough, chicken, beef, sauces) |
| `InventoryStock` | Per-branch on-hand qty (and reserved qty) |
| `Recipe` | Product → ingredients with qty |
| `Vendor` | Supplier directory |
| `PurchaseOrder` | Order placed to vendor |
| `GoodsReceipt` | Receipt of PO items into stock |
| `WasteLog` | Record of waste with reason |

### A.3 Stock Decrement Flow

```
order.state → CONFIRMED   ─►  reserve inventory  (qtyReserved += recipe * qty)
order.state → READY       ─►  no change          (still reserved)
order.state → DELIVERED   ─►  consume            (qtyOnHand -= recipe * qty; qtyReserved -= ...)
order.state → CANCELLED   ─►  release reservation
```

Implemented in a Mongo transaction with optimistic concurrency on `InventoryStock`. If insufficient stock at reservation time:
- For ingredients flagged "soft" (e.g., olives) → allow with low-stock alert.
- For ingredients flagged "hard" (e.g., dough) → reject order with `insufficient-stock` error; suggest alternative.

### A.4 Reorder Levels

- Per ingredient per branch `reorderLevel`.
- Nightly job evaluates `qtyOnHand <= reorderLevel` and pushes alert to branch manager + suggests PO draft.
- "Auto-create draft PO" toggle for routine items (manager approves before sending to vendor).

### A.5 Purchase Order Workflow

```
draft → sent (emailed/printed to vendor) → received (partial / full via Goods Receipt)
       │                                       │
       └► cancelled                            └► closed
```

Goods receipt creates positive stock movements and updates weighted-average unit cost (used in profit reports).

### A.6 Waste Logging

- Required fields: branch, item, qty, reason (overcooked, expired, dropped, spillage, customer return, training).
- Per-shift summary; weekly review meeting report.
- Reason codes drive RCA.

### A.7 Stock Counts (Cycle / Full)

- Count session created by manager.
- Mobile-friendly UI to enter counted qty per item.
- System computes variance (system qty − counted qty) and value impact.
- Variance > threshold requires manager note before commit.

### A.8 Reporting

- Stock-on-hand value per branch (per location, per category).
- Consumption per product per period.
- Waste rate.
- Vendor performance (on-time %, price drift).
- Cost-of-sales for profit reports.

---

## Part B — Delivery (Module 8)

### B.1 Goals

- Assign orders to drivers fairly & fast.
- Optimize multi-drop routes.
- Live tracking for customer + manager.
- Audit & analyze delivery performance.

### B.2 Driver Domain

- `drivers` (see schema).
- Per-driver state: `available | onJob | offline`.
- GPS heartbeat every 5s while active; 60s when available.
- Vehicle types: bike, motorcycle (most common), car.

### B.3 Order → Job Lifecycle

```
order.state = READY  ──►  create DeliveryJob{ orderId, status='queued' }
                          assignDriver()  → status='assigned'
driver picks up         → status='picked'   (order.state → OUT_FOR_DELIVERY)
driver arrives          → status='enroute'  (or skip to delivered)
POD captured            → status='delivered' (order.state → DELIVERED)
```

### B.4 Assignment Strategy

Configurable per branch:

1. **Manual** (manager picks driver) — small branches.
2. **Round-robin** among available drivers.
3. **Nearest available** by haversine.
4. **Batched** — if a second order to the same district is ready within X minutes, batch with first.

Assignment scored by:
- distance to pickup (driver's current pos to branch)
- driver workload (active deliveries)
- driver tier (probation / regular / star)
- order priority (Platinum customer, late SLA)

### B.5 Route Optimization

For batched deliveries:
- Mapbox Optimization API (or Google Routes) computes ordered waypoints + ETA per stop.
- Driver app shows turn-by-turn via Apple/Google Maps deep-link (we don't reinvent navigation).
- Re-optimize on cancellation or new add-on.

### B.6 Live Tracking (Customer)

- Customer app subscribes to `/tracking` room `order:{id}`.
- Server merges driver GPS + order state changes into a unified stream.
- Driver's exact location is shown only after pickup; before pickup, only branch ETA is shown (avoids privacy/anxiety issues).
- Map snapshots cached for support tickets.

### B.7 Proof of Delivery

Per branch policy:
- **Signature** on driver app screen
- **Photo** of bag at door
- **OTP** entered by customer (default)
- **NoContact** — driver attests delivery + timestamp + photo

Stored encrypted in S3 with retention.

### B.8 Driver Settlement

- Daily earnings = orders × delivery fee share + tips + bonuses (long-distance, late-night, peak-hour).
- Weekly statement exportable.
- Cash collected logged at drop-off, reconciled on return to branch.

### B.9 Analytics

- Avg delivery time (creation → delivered).
- On-time % vs promised ETA.
- Driver leaderboard.
- Failed delivery rate + reasons.
- Branch-level heatmap of delivery times by district.
- Customer satisfaction by driver (post-delivery rating in app).

### B.10 Failure Modes

| Scenario | Handling |
|---|---|
| No available driver | Manager alert; option to keep customer informed; auto-retry every 30s for 5 min |
| Driver app crash mid-job | Server uses last-known GPS; manager can reassign with one click |
| Failed delivery (no answer) | Driver attempts contact (masked number bridge); records reason; manager initiates refund/re-delivery |
| Delivery zone breach (customer outside polygon) | Block at checkout; suggest pickup |

### B.11 3rd-Party Aggregator Mode (Phase 2)

When HungerStation / Jahez / ToYou push an order into our API, it skips driver assignment locally — their drivers handle. We still print kitchen ticket and track preparation; tracking events get pushed back to aggregator via webhook.
