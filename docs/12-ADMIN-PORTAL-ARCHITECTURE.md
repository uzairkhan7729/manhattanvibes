# 12 — Admin Portal Architecture

> Back-office for head-office, marketing, branch managers, finance. React 18 + Vite + TypeScript SPA. Strictly **read-via-API, write-via-API** — no privileged backdoor.

## 1. Audience & Permissions

| Persona | Scope |
|---|---|
| SuperAdmin | Everything across all branches |
| BranchManager | Read everything for their branch(es); write orders/inventory/employees |
| Marketing | Customers, segments, campaigns, coupons, promotions (read-only on financials) |
| Finance | Reports, refunds (approve), VAT exports |
| Support | Customer lookup, order lookup, refund initiation (within limit) |

RBAC enforced server-side; UI hides what user can't access (purely cosmetic).

## 2. Folder Structure

```
apps/admin/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── routes/
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── catalog/
│   │   │   ├── categories/
│   │   │   ├── products/
│   │   │   ├── toppings/
│   │   │   ├── deals/
│   │   │   └── pizza-builder-config/
│   │   ├── inventory/
│   │   │   ├── items/
│   │   │   ├── stock/
│   │   │   ├── recipes/
│   │   │   ├── waste/
│   │   │   └── purchase-orders/
│   │   ├── promotions/
│   │   │   ├── coupons/
│   │   │   ├── campaigns/
│   │   │   └── rules/
│   │   ├── customers/
│   │   │   ├── list/
│   │   │   ├── segments/
│   │   │   └── loyalty/
│   │   ├── branches/
│   │   ├── employees/
│   │   ├── delivery/
│   │   │   ├── drivers/
│   │   │   ├── jobs/
│   │   │   └── zones/
│   │   ├── reports/
│   │   │   ├── sales/
│   │   │   ├── inventory/
│   │   │   ├── profit/
│   │   │   ├── vat/
│   │   │   └── exports/
│   │   ├── settings/
│   │   │   ├── tax/
│   │   │   ├── notifications-templates/
│   │   │   ├── feature-flags/
│   │   │   └── audit-log/
│   │   └── auth/
│   ├── components/
│   │   ├── tables/                # TanStack Table + filters + bulk actions
│   │   ├── forms/
│   │   ├── charts/                # Recharts wrappers
│   │   └── shared/
│   ├── store/                     # Redux Toolkit + RTK Query
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── permissions.ts
│   ├── theme/
│   └── i18n/
├── public/
└── vite.config.ts
```

## 3. Dashboard

Top section: live KPIs (today's sales, orders, AOV, on-time delivery %, average prep time).
Cards refresh via Socket.IO (`/admin` namespace) every 5s.

Charts:
- Sales by hour (today vs same day last week)
- Channel mix
- Top 10 products
- Branch leaderboard (SuperAdmin)
- Inventory alerts (low stock, near-expiry)

Filterable by branch, date range, channel.

## 4. Order Operations Console

- Live list, filter by state, channel, branch, search by order number / phone.
- Click → detail panel with timeline, items, payments, audit log.
- Actions: cancel (reason), refund (full/partial, manager approval if > threshold), reassign driver, reprint receipt, contact customer (masked-number bridge).
- Bulk actions: print kitchen tickets, export selection.
- "Force complete" with audit (used in incident recovery).

## 5. Catalog Editor

- Tree view of categories drag-drop.
- Product form with i18n tabs (AR/EN), images uploader (pre-signed S3), pricing, sizes/crusts for pizza, addons.
- Pizza-builder configurator: define which toppings appear, max per size, presets.
- Branch overrides editor (per-branch price/availability).
- Schedule publish (effectiveAt).

## 6. Promotions

- Coupon builder with live preview of discount on a sample cart.
- Campaign composer: pick segment → channel (push/SMS/email/WA) → template → schedule → estimated reach + cost.
- Rule engine UI for BOGO/bundle promos.

## 7. CRM

- Segment builder: drag predicates ("ordered ≥ 3 times in last 30 days AND prefers pickup AND last order >7 days ago").
- Customer 360 view: profile, orders, loyalty, complaints, contact preferences, lifetime spend.
- Bulk export (CSV) with audit + reason capture (PDPL).

## 8. Inventory

- Stock-on-hand per branch with low-stock highlight.
- Receive PO workflow (scan barcode, confirm qty, accept).
- Stock count screen with variance preview.
- Waste log entry with reason codes.

## 9. Reports

- Sales reports: daily Z, monthly, range with group-by.
- Cashier reports: per-shift, per-day.
- Inventory & profit.
- VAT report aligned with ZATCA.
- All reports exportable (CSV/Excel/PDF) — large exports run async.

## 10. Audit Viewer

- Filter by actor, target, action, date.
- Diff viewer for before/after.
- Tamper-evident: chain root displayed; "verified ✓".

## 11. Feature Flags & Settings

- Unleash UI embedded.
- Branch-level switches (e.g., "Pickup enabled", "Apple Pay enabled").
- Tax & VAT settings.
- Notification template management (Liquid-style placeholders).
- Working hours per branch.

## 12. Realtime in Admin

`/admin` Socket.IO namespace with rooms per branch. Events:
- `order.created`
- `order.state_changed`
- `payment.failed` (red toast)
- `inventory.low` (yellow toast)
- `driver.location` (map view)

## 13. UX & Tech Details

- Tailwind + shadcn/ui components.
- TanStack Table v8 with server pagination, column visibility, density, CSV export.
- Forms: React Hook Form + Zod (same Zod schemas as API).
- Code-split per route.
- Optimistic updates with rollback on error.
- Toast + dialog system; destructive actions confirm with typed entity name.
- Keyboard shortcuts (`/` search, `g+o` orders, `g+r` reports).
- Dark mode.

## 14. Security

- Same JWT + refresh as customer apps.
- MFA mandatory for SuperAdmin.
- IP allowlist option per role (e.g., Finance only from office).
- Idle timeout 15 min → re-auth.
- Sensitive screens (audit, exports) gated by recent re-auth.
