# Deployment Diagram (AWS reference)

```
Region: me-south-1 (Bahrain) [or KSA via STC Cloud / OCI Riyadh]
│
├── Edge: Cloudflare (WAF, DDoS, CDN, image resize)
│
└── VPC
    ├── Public subnets (3 AZs)
    │   └── ALB (HTTPS, TLS 1.3)
    │
    ├── Private subnets (3 AZs) ─ EKS 1.30
    │   ├── nodegroup-general (api, web, admin, kds)
    │   ├── nodegroup-realtime (socket pods, sticky-session-friendly)
    │   ├── nodegroup-workers (notification, report, sync, webhook)
    │   └── nodegroup-observability (prom, grafana, loki, tempo)
    │
    ├── Data subnets (3 AZs)
    │   ├── ElastiCache Redis (3-node cluster)
    │   ├── Mongo Atlas VPC peering endpoint (M40)
    │   └── S3 VPC endpoint (gateway)
    │
    ├── NAT GW (egress only)
    │   └── External APIs: payment gateways, SMS, ZATCA, FCM/APNs
    │
    └── Secrets Manager + KMS
        ├── mv-jwt-sign-prod (RSA key)
        ├── mv-mongo-prod (DB password)
        └── mv-s3-prod (SSE-KMS key)

Branches (each)
└── LAN
    ├── POS terminals (Windows 11) ─ Electron app
    ├── KDS displays (Chromium kiosk) ─ PWA
    ├── Receipt + kitchen printers (LAN/USB)
    ├── Card terminals (Geidea/HyperPay POS)
    └── Router with 4G LTE failover
    [outbound only] ──────────────────► Cloudflare → ALB
```
