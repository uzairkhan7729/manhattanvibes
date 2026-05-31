# C4 L2 — Container Diagram

```
┌─────────────────────── Client Tier ─────────────────────────┐
│ POS (Electron+React)  Web (Next.js)  Mobile (RN)             │
│ Admin (React/Vite)    KDS (React PWA)  Driver (RN)           │
└────────────┬─────────────────────────────────────────────────┘
             │  HTTPS / WSS
┌────────────▼─────────────────────────────────────────────────┐
│ Cloudflare (DNS, WAF, CDN)                                   │
└────────────┬─────────────────────────────────────────────────┘
             │
   ┌─────────▼──────────────────┐
   │  ALB / Ingress              │
   └─────────┬──────────────────┘
   ┌─────────┴──────────────────┐
   │  Web pods (Next.js)         │
   │  API pods (Express + TS)    │
   │  Socket pods (Socket.IO)    │
   │  Worker pods (BullMQ)       │
   └─────────┬──────────────────┘
             │
   ┌─────────▼──────────────────┐
   │  MongoDB Atlas (M40 multi-AZ)│
   │  ElastiCache Redis cluster   │
   │  S3 (images, exports, audit) │
   │  Secrets Manager             │
   │  KMS                         │
   └─────────────────────────────┘
             │
   ┌─────────▼──────────────────┐
   │ External:                   │
   │  HyperPay/Moyasar/STC Pay   │
   │  SES / Unifonic / WA BSP    │
   │  FCM / APNs                 │
   │  Mapbox / Google Routes     │
   │  ZATCA Fatoora              │
   └─────────────────────────────┘
```
