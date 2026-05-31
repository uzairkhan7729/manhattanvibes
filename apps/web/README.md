# @mv/web — Customer Website

Next.js 15 (App Router) + Tailwind + TanStack Query.

## Run

```powershell
npm run infra:up                          # mongo + redis
npm run dev --workspace=@mv/api           # API on :8088
npm run dev --workspace=@mv/web           # web on :4001 (proxies /api -> :8088)
```

Visit http://localhost:4001.

## Surfaces

| Route | Purpose |
|---|---|
| `/`                | Home — hero, features, branch list |
| `/menu`            | Catalog grouped by category |
| `/menu` (modal)    | Pizza builder — live server-priced quote |
| `/cart`            | Cart with quote summary |
| `/checkout`        | Guest checkout (OTP-bootstrapped) → places order |
| `/track`           | Enter order id |
| `/track/[id]`      | Live order tracking (Socket.IO + 5s polling fallback) |
| `/account`         | Profile, loyalty points + tier, order history |
