# C4 L3 — API Component Diagram

```
                     ┌──────────── Express App ─────────────┐
                     │                                       │
   HTTP/HTTPS ─────► │  Router (per module)                  │
                     │     │                                  │
   WSS ────────────► │  Socket.IO server                     │
                     │     │                                  │
                     │  Middleware chain                      │
                     │     ├─ requestId                       │
                     │     ├─ auth (JWT)                      │
                     │     ├─ tenant (branch scope)           │
                     │     ├─ rbac                            │
                     │     ├─ ratelimit (Redis)               │
                     │     ├─ audit                           │
                     │     └─ error                           │
                     │     │                                  │
                     │  Controllers (thin)                    │
                     │     │                                  │
                     │  Services (domain)                     │
                     │   ├─ Auth                              │
                     │   ├─ Catalog                           │
                     │   ├─ Order  ────► State machine        │
                     │   ├─ Payment ───► Gateway adapters     │
                     │   ├─ Loyalty                           │
                     │   ├─ Promo                             │
                     │   ├─ Inventory                         │
                     │   ├─ Branch / Employee                 │
                     │   ├─ Delivery / Driver                 │
                     │   ├─ Notification (enqueues)           │
                     │   └─ Report                            │
                     │     │                                  │
                     │  Repositories (Mongoose)               │
                     │   ├─ MongoDB                           │
                     │   ├─ Redis (cache + locks)             │
                     │   └─ Queue (BullMQ on Redis)           │
                     │                                       │
                     └───────────────────────────────────────┘
                                       │
                              ┌────────┼─────────┐
                              ▼        ▼         ▼
                          Mongo     Redis     Workers
                                              ├─ Notification
                                              ├─ Sync
                                              ├─ Report
                                              ├─ Webhook
                                              └─ ZATCA
```
