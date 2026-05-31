# 04 — System Architecture

## 1. Logical Architecture

```
┌─────────────────────────────── EDGE ───────────────────────────────┐
│  Cloudflare (DNS, WAF, DDoS, CDN, Image transformation)            │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────────┐
│  Application Load Balancer (ALB / GCP LB)  — TLS terminate, mTLS    │
│  to backend optional for high-trust paths (ZATCA, payments)         │
└────────────┬─────────────────────────────────┬─────────────────────┘
             │                                 │
   ┌─────────▼──────────┐            ┌─────────▼──────────┐
   │  Web tier (Next.js) │           │  Realtime tier      │
   │  Containerized, HPA │           │  Socket.IO nodes    │
   └──────────┬──────────┘           └──────────┬──────────┘
              │                                 │
              └───────────────┬─────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │   API tier (Node/Express)      │
              │   HPA 4 → 40 pods              │
              └───────────────┬────────────────┘
                              │
       ┌──────────────────────┼────────────────────────────┐
       │                      │                            │
┌──────▼──────┐       ┌───────▼───────┐           ┌────────▼─────────┐
│ MongoDB Atlas│      │ Redis Cluster │           │  Object Storage  │
│ (M40 + read │      │  (cache + bull│           │  S3 / R2         │
│  replicas)   │      │   queue)      │           │  (images, exports)│
└──────────────┘      └───────────────┘           └──────────────────┘

      │                                  │
      ▼                                  ▼
┌──────────────┐                ┌─────────────────────────┐
│ Worker tier  │                │ External integrations    │
│ BullMQ procs │                │ • Payment GW (HyperPay)  │
│ (HPA queue   │                │ • SMS (Unifonic)         │
│  depth)      │                │ • Email (SES)            │
└──────────────┘                │ • WhatsApp BSP           │
                                │ • ZATCA fatoora          │
                                │ • Maps (Mapbox/Google)   │
                                │ • Push (FCM/APNs)        │
                                └──────────────────────────┘
```

## 2. Physical Deployment (AWS reference; portable to GCP/Azure/OCI)

| Layer | AWS Service | Notes |
|---|---|---|
| DNS / WAF / CDN | Cloudflare | DDoS L3/4/7, image resizing |
| Compute | EKS (Kubernetes 1.30) in `me-south-1` (Bahrain) or `me-central-1` (UAE) | KSA region via STC Cloud or OCI Riyadh if data-residency hard-required |
| Image registry | ECR | Per-app repositories, vulnerability scan on push |
| Database | MongoDB Atlas dedicated M40+ | Multi-AZ; daily snapshots + PITR |
| Cache/Queue | ElastiCache Redis 7 (3-node) | Cluster mode; AOF persistence |
| Object store | S3 (private bucket, KMS-encrypted) | Lifecycle: hot 30d, IA 90d, Glacier 365d |
| Secrets | AWS Secrets Manager | Auto-rotation for DB creds |
| Observability | Prometheus + Grafana + Loki + Tempo (self-hosted on EKS) | OR Datadog if licensed |
| CI/CD | GitHub Actions + ArgoCD (GitOps) | Helm chart in `infra/k8s/` |
| KMS | AWS KMS | JWT signing key, S3 SSE-KMS, RDS-style envelope encryption |

## 3. Network Topology

```
Internet
   │
   ▼ (Cloudflare proxy orange-cloud)
[Public ALB] ──── (only 443) ──► [VPC us-east-1 / me-south-1]
                                    │
                ┌───────────────────┴────────────────────┐
                │ Public subnets (ALB only)              │
                ├────────────────────────────────────────┤
                │ Private subnets (EKS nodes, workers)   │
                │   - api-pods                           │
                │   - web-pods                           │
                │   - worker-pods                        │
                │   - socket-pods                        │
                ├────────────────────────────────────────┤
                │ Data subnets (no internet)             │
                │   - ElastiCache                        │
                │   - Mongo Atlas peering endpoint       │
                └────────────────────────────────────────┘
                          │
                          ▼ (NAT GW for egress only)
                External APIs (payments, SMS, ZATCA)
```

Branch POS uses **outbound only**: HTTPS to API + WSS to realtime. No inbound holes opened on store networks.

## 4. Environments

| Env | Purpose | Data | URL |
|---|---|---|---|
| dev | Engineering | Synthetic | dev.api.manhattanvibes.sa |
| staging | Pre-prod, UAT | Production-like (PII-scrubbed) | staging.api.manhattanvibes.sa |
| prod | Live | Real | api.manhattanvibes.sa |

Branch-by-branch canary: feature flag `pos.new_sync_engine=ENABLED` for branch `RUH-1` only.

## 5. Capacity Plan (Year 1)

| Metric | Baseline | Peak (Ramadan iftar) |
|---|---|---|
| Concurrent users | 5,000 | 25,000 |
| API RPS | 400 | 2,500 |
| Orders / min | 80 | 600 |
| Mongo ops / sec | 2,000 | 12,000 |
| Push notifications / min | 200 | 1,500 |

**Scale plan:**
- API pods: HPA 4–40 on CPU + RPS custom metric.
- Mongo: scale to M60 14 days before Ramadan; revert after.
- Redis: shard on `branchId` if cluster cardinality grows.
- Pre-warm pods 30 min before iftar window using KEDA cron scaler.

## 6. High Availability & DR

- **Multi-AZ** across 3 zones for EKS, Redis, Mongo.
- **RPO 5 min** (Mongo PITR); **RTO 1h** (Helm redeploy + restore).
- **Backups**: daily snapshot + 12-hourly oplog tail to S3 cross-region.
- **Chaos drills** quarterly: kill an AZ, kill primary, kill payment GW (verify fallback).

## 7. Branch-Edge Architecture (Physical POS)

```
Branch LAN (192.168.x.x)
   │
   ├── POS terminals (Windows 11 / Sunmi T2 / Elo I-Series) — Electron app
   ├── KDS displays (Chromium kiosk) — PWA
   ├── Receipt printers (Epson TM-m30 / Bixolon SRP-350) — LAN/USB
   ├── Card terminals (Geidea, Network International) — RS232/USB integrated
   ├── Kitchen printer (Epson TM-T20) — LAN
   ├── Router (with 4G LTE failover SIM)
   │
   └── Outbound NAT ──► Internet ──► api.manhattanvibes.sa
```

Each branch has a **local Electron-hosted sync service** that owns offline queue + printer drivers. POS terminals talk to this local service (LAN) when offline; service talks to API when online.

## 8. Reference Diagrams (ASCII; PNG/Mermaid in `docs/diagrams/`)

See `docs/diagrams/`:
- `01-context.md` — context diagram (C4 L1)
- `02-container.md` — container diagram (C4 L2)
- `03-component-api.md` — API components (C4 L3)
- `04-deployment.md` — physical deployment
- `05-order-sequence.md` — order placement sequence
- `06-pos-sync.md` — POS sync sequence
