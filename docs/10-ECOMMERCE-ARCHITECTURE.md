# 10 — Ecommerce Architecture (Web)

> Customer-facing website. Stack: Next.js 15 (App Router) + React 18 + TypeScript.

## 1. Rendering Strategy

| Surface | Strategy | Reason |
|---|---|---|
| Marketing pages (home, deals, locations) | Static / ISR (revalidate 600s) | SEO + perf |
| Category & product detail | RSC + ISR with `searchParams` for branchId | Personalized per branch but cacheable |
| Pizza builder | Client component (CSR) | Heavy interactivity |
| Cart | Client + Zustand store, persisted in localStorage | — |
| Checkout | Client; server actions for order creation | PII never in client logs |
| Account, order history | RSC with cookies-based auth | Per-user |
| Live tracking | Client + Socket.IO | Realtime |

## 2. Folder Structure (`apps/web`)

```
apps/web/
├── app/
│   ├── [locale]/                  # ar | en
│   │   ├── layout.tsx
│   │   ├── page.tsx               # home
│   │   ├── menu/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── pizza-builder/
│   │   ├── deals/
│   │   ├── locations/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── account/
│   │   │   ├── orders/
│   │   │   ├── addresses/
│   │   │   └── loyalty/
│   │   └── track/[orderId]/
│   ├── api/                       # only Next.js route handlers if needed (most go to central API)
│   └── globals.css
├── components/
│   ├── menu/
│   ├── pizza-builder/
│   ├── cart/
│   ├── checkout/
│   └── shared/                    # navbar, footer, language switcher
├── lib/
│   ├── api-client.ts              # sdk-client wrapper
│   ├── auth.ts                    # cookies + refresh
│   ├── analytics.ts               # GA4 + Meta Pixel + TikTok
│   └── cart-store.ts              # zustand
├── middleware.ts                  # locale & branch resolution
├── next.config.mjs
└── tailwind.config.ts
```

## 3. Branch Resolution

Order of precedence:
1. Explicit branchId in URL (`?branch=RUH-1`)
2. Customer's default delivery address → resolve via `/branches?lat=&lng=` → pick covering branch
3. IP geolocation suggestion
4. Manual picker modal

Branch becomes part of the cache key for catalog/pricing queries.

## 4. Pizza Builder

```
[Choose Size]  S/M/L/XL  →  [Choose Crust]  Classic/Thin/Stuffed  →  [Choose Sauce]
   →  [Choose Cheese]  →  [Add Toppings]  (max per size)  →  [Review & Add to Cart]
```

- Real-time price recalc on each click (computed client-side, validated server-side at quote).
- Visual canvas drawing toppings on a pizza base for delight.
- Half-and-half support (left/right halves; price = max of the two halves per spec).
- Allergen / spicy / veg badges.

## 5. Cart & Checkout

- Cart persisted in localStorage with `cartId`; surfaces "you have an unfinished cart" if user returns.
- Quote API `POST /orders/quote` called on cart open, on coupon entry, on loyalty toggle, on address change.
- Loyalty redemption slider (snap to 100-pt increments).
- Coupon entry with inline validation.
- Address selection from saved addresses or new (with Mapbox pin).
- ETA shown ("~35 min").
- Payment method picker (Mada/Apple Pay/STC Pay/Visa/MC).
- Order placed → redirect to live tracking page.

## 6. Live Order Tracking

- Socket.IO room `order:{id}` after JWT.
- Public tracking link uses a signed token (no auth required, expires 24h) so customer can share with family.
- States as visual stepper; for delivery, embedded map with driver pin.

## 7. SEO

- Per-locale routes (`/ar/...`, `/en/...`); `hreflang` tags.
- Structured data (`Restaurant`, `Menu`, `Product`, `Offer`, `LocalBusiness`).
- Sitemap.xml + robots.txt generated.
- Open Graph + Twitter Card images per page.

## 8. Performance

- `next/image` with Cloudflare Image Resizing.
- Font subsetting (Arabic + Latin) self-hosted.
- Code-split per route; lazy-load builder canvas.
- Targets: LCP <2.0s (3G), TBT <200ms, CLS <0.1.

## 9. Accessibility

- WCAG 2.1 AA; axe-core CI gate.
- Full keyboard navigation including pizza builder (radio groups + checkbox toppings).
- Screen-reader labels for canvas-rendered pizza.
- RTL CSS via Tailwind's `dir` variants.

## 10. Analytics & Marketing

- GTM-based; only minimum first-party data.
- Server-side events to Conversion API (Meta/TikTok) for accuracy.
- A/B test harness via GrowthBook (self-hosted) feature flags.

## 11. Auth Flow

- OTP-primary on first registration (phone).
- Email/password optional.
- Social: Google + Apple.
- Session = cookie holding JWT (httpOnly, secure, samesite=lax) + refresh token in another httpOnly cookie.
- CSRF: same-site cookies + custom header check on state-mutating fetches.

## 12. Error & Empty States

- Empty cart, no items in category, no delivery to address — all designed with clear next-step CTAs (e.g., "Pickup available from RUH-1 — 2.4 km away").
- Offline banner if browser loses connectivity.
- 5xx fallback to cached menu, with "checkout temporarily unavailable" gate.
