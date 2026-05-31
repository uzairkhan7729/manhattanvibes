# 19 — UI/UX Design

> Sitemaps, navigation models, screen lists, and wireframe descriptions for all four user-facing apps. Visual design system is delivered separately in Figma; this doc establishes structure.

## 1. Design Principles

1. **Speed > polish.** Every interaction must feel instant; perceived latency budget < 100ms.
2. **Bilingual & RTL-native.** Arabic is first-class, not a translation afterthought.
3. **One-thumb friendly.** Mobile primary; bottom navigation, large tap targets.
4. **Reachable accessibility.** WCAG 2.1 AA; contrast, focus, alt text.
5. **Local cultural cues.** Calendar formats, prayer-time-aware quiet hours, Ramadan theming, Iftar pre-orders.
6. **No dead ends.** Empty/error states always offer a next action.

## 2. Design System (Figma library overview)

- Color: brand primary, neutral grayscale, semantic (success/warning/error/info), dark-mode variants.
- Type: Arabic (IBM Plex Sans Arabic), Latin (Inter); 8-step scale.
- Spacing: 4pt grid.
- Components: Button (5 variants), Input, Select, Modal, Toast, Card, List, Table, Tabs, Badge, Avatar, Skeleton, EmptyState, ErrorState, Banner, Snackbar.
- Iconography: Lucide (with Arabic-aware versions for arrows).
- Motion: Reanimated specs (springs, durations).

---

## 3. Customer Web (M3) — Sitemap

```
/
├── /menu
│   ├── /menu/{category-slug}
│   └── /menu/product/{slug}
├── /pizza-builder
├── /deals
├── /locations
│   └── /locations/{branch-code}
├── /track/{orderId}
├── /cart
├── /checkout
├── /account
│   ├── /orders
│   ├── /orders/{id}
│   ├── /addresses
│   ├── /loyalty
│   ├── /wallet
│   ├── /coupons
│   ├── /referrals
│   └── /settings
├── /auth
│   ├── /login
│   ├── /register
│   └── /reset
├── /about
├── /privacy
├── /terms
└── /contact
```

### Top Navigation (web)

- Logo | Menu | Deals | Locations | Track Order | (Lang AR/EN) | Cart | Login/Account

### Screen Wireframe Descriptions (web — key screens)

- **Home:** hero with promo carousel; "Order Now" CTA; quick category tiles; "Most Loved" rail; deals strip; locations finder; loyalty teaser; trust strip (Mada/Apple Pay/STC Pay badges); footer with delivery hours per region.
- **Menu (category):** branch picker at top; filters (veg, spicy, allergens); product grid with quick-add; sticky cart on right (desktop) / floating cart button (mobile).
- **Pizza Builder:** stepper UI; left side stepper controls; right side live pizza visual; running price card; toppings grouped (Sauces, Cheeses, Meats, Veggies); max-toppings counter.
- **Cart:** line items with thumbnail, qty, modifiers preview; coupon entry inline; loyalty redeem slider; subtotal / discount / VAT / total; ETA tile; CTA "Continue to checkout".
- **Checkout:** address picker (map view); pay method picker (cards with brand logos); review summary; place order button; busy-state with spinner; success → tracking redirect.
- **Tracking:** stepper (Confirmed → Preparing → Baking → Ready → Out for delivery → Delivered) with timestamps; for delivery, map with driver pin; ETA countdown; share link button; "Contact branch" button.
- **Account/Loyalty:** tier card with progress bar to next tier; points balance with expiry note; rewards catalog; ledger collapsible.

---

## 4. Mobile App (M4) — Sitemap

Tab bar: Home | Menu | Orders | Loyalty | Profile.

```
Home (tab)
├── Recommended
├── Reorder last
├── Active promotions

Menu (tab)
├── Categories
├── Product Detail
├── Pizza Builder
├── Cart
├── Checkout (Address → Payment → Place)
└── Tracking

Orders (tab)
├── Active
├── History
├── Reorder
└── Feedback

Loyalty (tab)
├── Tier & Points
├── Rewards Catalog
├── Wallet
└── Referrals

Profile (tab)
├── Account
├── Addresses
├── Payment Methods
├── Notifications & Preferences
├── Language
├── Support
└── Logout
```

### Wireframe descriptions (mobile — key screens)

- **Onboarding:** 3 swipeable cards (Fast pickup, Live tracking, Rewards) → Phone entry → OTP → Profile (optional skip) → Allow notifications.
- **Home:** greeting, branch chip, deals carousel, reorder strip, big categories grid.
- **Pizza Builder:** vertical scroll of steps; sticky bottom "Add to cart — XX.XX SAR".
- **Cart:** scrollable items; coupon + loyalty controls collapsible; sticky CTA at bottom.
- **Checkout:** single screen with collapsible sections (Delivery, Payment, Promotions, Review).
- **Tracking:** map + stepper; haptic feedback on state changes.
- **Loyalty:** prominent tier visual; expiring points alert; progress to next tier; redeemable rewards.

---

## 5. POS (M2) — Sitemap

```
Login (cashier PIN)
└── Shell (sticky top bar: Branch, Cashier, Connectivity, Sync queue depth)
    ├── Sales (default)
    │   ├── Order Type chips: Dine-in / Take-away / Delivery / Pickup
    │   ├── Menu grid (left)  +  Order ticket (right)
    │   ├── Modifier modal
    │   ├── Hold / Recall / Cancel actions
    │   └── Pay → Payment modal (Cash / Card / Apple Pay / STC Pay / Split)
    ├── Tables
    │   ├── Floor plan grid (sections)
    │   ├── Merge / Split / Transfer dialogs
    │   └── Table → assigned order
    ├── Orders
    │   ├── Open
    │   ├── Today
    │   └── Search by # / phone
    ├── KDS preview (read-only)
    ├── Reports
    │   ├── Cashier shift
    │   ├── Z-report (manager-only)
    │   └── Hourly sales
    ├── Inventory (basic)
    │   ├── 86 item toggles
    │   └── Waste log
    └── Settings
        ├── Printer test
        ├── Card reader test
        ├── Sync inspector
        └── Update check
```

### Wireframe descriptions (POS — key screens)

- **Sales screen:** big category tabs at top; product grid with images; right panel = current order with line items, modifiers, totals; bottom action bar: Hold, Recall, Customer (assign), Pay.
- **Pay modal:** large numpad for cash; tabs for Cash/Card/Apple Pay/STC Pay/Split; QR display for STC Pay; result confirmation.
- **Tables screen:** drag-drop floor plan; color codes (free/occupied/reserved/cleaning); tap → action sheet (assign new order, view bill, merge, split, transfer).
- **Sync inspector:** queue table with status, retries, last error; manual "Sync now"; alert on conflicts.

---

## 6. Admin Portal (M5) — Sitemap

```
Side nav:
├── Dashboard
├── Orders
│   ├── Live
│   ├── History
│   └── Refunds
├── Catalog
│   ├── Categories
│   ├── Products
│   ├── Toppings
│   ├── Deals
│   └── Builder Config
├── Promotions
│   ├── Coupons
│   ├── Campaigns
│   └── Promo Rules
├── Customers
│   ├── List
│   ├── Segments
│   └── Loyalty Settings
├── Inventory
│   ├── Items
│   ├── Stock (per branch)
│   ├── Recipes
│   ├── Waste
│   └── Purchase Orders
├── Branches
├── Employees
├── Delivery
│   ├── Drivers
│   ├── Jobs
│   └── Zones
├── Reports
│   ├── Sales
│   ├── Inventory
│   ├── Profit
│   ├── VAT
│   └── Exports
├── Settings
│   ├── Tax
│   ├── Notification Templates
│   ├── Feature Flags
│   ├── Audit Log
│   └── Users & Roles
└── Sign out
```

### Wireframe descriptions (admin — key screens)

- **Dashboard:** KPI tiles, channel mix donut, hourly sales line, branch leaderboard table, alerts feed.
- **Orders Live:** real-time stream; left filter rail; right detail drawer with timeline + actions.
- **Catalog Product:** tabs (Details, Pricing, Branch Overrides, Recipe, SEO); preview pane.
- **Reports Sales:** filters bar; chart; table with sticky header; CSV/PDF/Excel export.

---

## 7. KDS (M10) — Sitemap

Single screen (kiosk) — columns described in [13-KDS-ARCHITECTURE.md](13-KDS-ARCHITECTURE.md). Settings overlay (long-press) for station selection and brightness.

---

## 8. Driver App — Sitemap

```
Login (QR provisioning) → Job list → Active job (map + steps) → POD → Earnings
                                                                 → Profile / Support
```

Designed for one-handed use, big buttons, voice-friendly prompts.

---

## 9. Navigation Heuristics

- **Web:** 5-click rule for any common task.
- **Mobile:** ≤3 taps for reorder, ≤4 taps for new order.
- **POS:** new order to pay = ≤6 taps for a single-pizza order.
- **Admin:** keyboard-first; `/` opens global search.

## 10. Empty / Error States

Every list, every form, every map renders a designed empty state with: visual + headline + body + primary action. No raw error codes shown to customers.

## 11. Accessibility

- AA contrast in every theme (light + dark + high-contrast).
- Focus rings preserved; never `outline: none`.
- Touch targets ≥44px iOS / ≥48dp Android.
- Screen-reader: meaningful labels, live regions for state changes (e.g., "Order ready").
- Avoid sole-color cues; pair color with icon or text.
- Reduced motion respected.

## 12. Localization (RTL details)

- `dir="rtl"` flips entire layout in Arabic.
- Mirrored icons (arrows, chevrons) via CSS logical properties.
- Numbers can render in Arabic-Indic OR Western digits per user preference (default Western for prices to align with payment receipts).
- Date format: Hijri OR Gregorian per user preference; reports always Gregorian for ZATCA.

## 13. Content Style

- Concise, friendly, polite — never imperative.
- Arabic uses MSA (Modern Standard Arabic) for clarity; specific KSA terms allowed for menu items.
- All copy in `packages/i18n` namespaced; tested for length variance (Arabic often ~30% shorter, German ~30% longer — we ship to Arabic + English only, but design tolerates both).
