# C4 L1 — Context Diagram

```
                       ┌──────────────────────────┐
                       │      Manhattan Vibes      │
                       │   Restaurant Ecosystem    │
                       └────────────┬──────────────┘
                                    │
       ┌──────────┬────────┬────────┼────────┬────────┬────────────┐
       │          │        │        │        │        │            │
   Customer   Cashier   Kitchen  Driver  Mgr/Mkt  HQ Finance    ZATCA
   (web/app)  (POS)    (KDS)    (app)   (Admin)   (Admin)    (e-invoice)
       │          │        │        │        │        │            │
       │          ▼        ▼        ▼        ▼        ▼            │
       │  ┌────────────────────────────────────────────────┐       │
       └─►│             Central API (M1)                    │◄──────┘
          │   + Realtime (Socket.IO) + Workers              │
          └────────────────────────────────────────────────┘
                  │           │             │
          ┌───────▼──┐    ┌───▼────┐   ┌────▼────────┐
          │ Payment  │    │  SMS   │   │ Push        │
          │ Gateways │    │ Email  │   │ FCM/APNs    │
          │ Mada/SCP │    │ WhatsApp│   └─────────────┘
          │ Apple Pay│    └────────┘
          └──────────┘
```
