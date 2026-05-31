# 08 — DevOps & Deployment

## 1. Environments

| Env | Branch | Auto-deploy? | Data | Access |
|---|---|---|---|---|
| dev | feature/* (preview) | yes, ephemeral per PR | synthetic | engineering |
| staging | main | yes | prod-mirrored, PII-scrubbed | eng + QA + product |
| prod | release/* tag | manual approval | live | restricted (break-glass) |

## 2. Container Strategy

| App | Base image | Notes |
|---|---|---|
| api | `node:22-alpine` (multi-stage; final `distroless/nodejs22`) | non-root user, tini PID1 |
| workers | same as api | different entrypoint |
| web (Next.js) | `node:22-alpine` standalone | runs `next start` or static export depending |
| admin | `nginx:alpine` | static `dist/` |
| kds | `nginx:alpine` | static |
| pos | **not containerized** — distributed as Electron installer |
| mobile | **not containerized** — built via EAS |

Image signing: cosign. Promotion: `dev-sha-...` → `staging` → `prod-vX.Y.Z` immutable tag.

### Sample `apps/api/Dockerfile`

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN corepack enable && pnpm install --frozen-lockfile --filter=api...

FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter=api build

FROM gcr.io/distroless/nodejs22-debian12 AS runtime
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
USER nonroot
EXPOSE 3000
CMD ["dist/main.js"]
```

## 3. Kubernetes Topology (Helm chart `infra/k8s/charts/mv`)

Workloads:
- `api`           — Deployment, HPA (CPU + RPS), PDB minAvailable=2
- `workers-*`     — Deployment per queue (notifications, reports, sync, webhook), KEDA on queue depth
- `socket`        — Deployment, sticky sessions via cookie; Redis adapter
- `web`           — Deployment behind Ingress
- `admin`, `kds`  — Deployment behind Ingress
- `redis`         — ElastiCache (external)
- `prometheus`, `grafana`, `loki`, `tempo`, `alertmanager` — observability stack
- `argocd`        — GitOps controller
- `unleash`       — feature flags
- `cert-manager`, `external-dns` — ingress glue

Network policies restrict pod-to-pod traffic. Default deny + explicit allow.

## 4. CI/CD (GitHub Actions)

Two pipelines: `ci.yml` (on PR) and `release.yml` (on tag).

### `ci.yml` — runs on every PR

```yaml
name: ci
on: [pull_request]
jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint
      - run: pnpm -r typecheck
      - run: pnpm -r test -- --coverage
      - run: pnpm -r build
      - name: Codecov
        uses: codecov/codecov-action@v4
      - name: Trivy fs scan
        uses: aquasecurity/trivy-action@master
        with: { scan-type: fs, severity: HIGH,CRITICAL }
      - name: Semgrep
        uses: returntocorp/semgrep-action@v1
```

### `release.yml` — runs on `v*` tag

```yaml
name: release
on:
  push:
    tags: ['v*.*.*']
jobs:
  build-and-push:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, web, admin, kds, workers]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: aws-actions/configure-aws-credentials@v4
        with: { role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE }}, aws-region: me-south-1 }
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push
        uses: docker/build-push-action@v6
        with:
          file: apps/${{ matrix.app }}/Dockerfile
          tags: ${{ steps.ecr.outputs.registry }}/mv-${{ matrix.app }}:${{ github.ref_name }}
          provenance: true
          sbom: true
      - name: Cosign sign
        run: cosign sign --yes ${{ ... }}
  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - run: |
          git -C infra/k8s pull
          yq -i '.image.tag="${{ github.ref_name }}"' charts/mv/values-staging.yaml
          git commit -am "staging: ${{ github.ref_name }}" && git push
          # ArgoCD picks up the change.
  deploy-prod:
    needs: deploy-staging
    environment: production       # GitHub env requires approval
    runs-on: ubuntu-latest
    steps:
      - run: |
          yq -i '.image.tag="${{ github.ref_name }}"' charts/mv/values-prod.yaml
          git commit -am "prod: ${{ github.ref_name }}" && git push
```

### POS auto-update pipeline

GitHub Actions builds NSIS installer signed with EV cert → uploads to S3 bucket → publishes `latest.yml`. `electron-updater` clients pull deltas. Staged rollout: 5% → 25% → 100% over 72h, with kill switch via feature flag.

### Mobile EAS pipeline

`eas build --platform all --profile production` on tag → submission to TestFlight (manual promote) and Play Internal track. EAS Update for hot-fix JS bundles between native releases.

## 5. Observability

| Pillar | Tool | Notes |
|---|---|---|
| Logs | Pino → Loki | Structured JSON, 30d retention; PII-redacted |
| Metrics | prom-client → Prometheus → Grafana | RED + USE dashboards |
| Traces | OpenTelemetry → Tempo | sampling 5% baseline, 100% for errors |
| Synthetic | Checkly | Pings core flows: catalog load, place order, login OTP |
| RUM | Sentry (web/mobile) | error tracking + perf |
| Uptime | Statuspage.io | public status page |

### Golden Signals & SLOs

| Service | SLI | SLO |
|---|---|---|
| API | success rate (non-5xx) | 99.95% / 30d |
| API | P95 latency | < 300ms |
| Realtime | message deliver < 2s | 99.9% |
| POS sync | batch ack < 5s | 99% |
| Web | LCP P75 | < 2.5s |
| Mobile | crash-free sessions | > 99.5% |

Alerting: error budget burn-rate alerts (1h fast + 24h slow), paged to PagerDuty.

## 6. Logging Stack (ELK alternative noted)

- Loki + Grafana for log search (default).
- Optional ELK stack (Elasticsearch + Logstash + Kibana) deployed for clients requiring it. Pino's JSON output is consumed by either.
- Shipped via vector/fluent-bit DaemonSet on the cluster.

## 7. Backup Strategy

| Asset | Method | Retention |
|---|---|---|
| MongoDB Atlas | Daily snapshot + continuous backup (oplog) | 7d daily, 30d weekly, 12 months monthly |
| MongoDB PITR | 24h granular | 24h |
| Redis | AOF (no RDB) | 7d backups copied to S3 |
| S3 buckets | Versioning + cross-region replication | 7y on critical buckets |
| Kafka/queues | Not persisted long-term; topics replayed via Redis stream if added later | — |
| Branch POS local SQLite | Nightly delta to API; manager can trigger emergency restore | 30d |

Quarterly restore drill: pick a random snapshot, restore to a sandbox cluster, run smoke suite, log RTO/RPO actuals.

## 8. Disaster Recovery

- Multi-AZ active-active in primary region.
- Phase-2: cross-region DR (warm-standby) — Mongo cross-region replica, S3 replication, DNS failover via Route 53.
- Runbook in `runbooks/dr.md` (region failover, payment-gateway failover, ZATCA outage degraded mode).

## 9. Branch Network Resilience

- Each branch on commodity ISP + 4G LTE failover (mikrotik/teltonika).
- POS designed to function fully offline (see doc 09). LTE failover handles short-blip orders; offline mode handles outages.

## 10. Cost & Capacity Discipline

- Monthly cost review with anomaly alerts (CloudCost or Vantage).
- Autoscaling caps (max pods) to bound runaway spend during incidents.
- Pre-purchase 1-yr Savings Plans for baseline; on-demand for surge.

## 11. Runbooks (delivered alongside code)

- `runbooks/incident-sev1.md`
- `runbooks/database-failover.md`
- `runbooks/payment-gateway-outage.md`
- `runbooks/zatca-outage.md` (degraded mode: queue invoices, clear when restored within 24h grace)
- `runbooks/pos-mass-resync.md`
- `runbooks/release-rollback.md`
- `runbooks/secrets-rotation.md`

## 12. Onboarding & Local Dev

`pnpm dev` brings up the whole stack via docker-compose:
- mongo (replica-set), redis, mailhog (email), minio (S3-compat), maildev, opentelemetry collector.

Seed scripts populate categories, products, branches, sample customers and orders.

## 13. Release Cadence

- API: weekly minor release (feature) + ad-hoc patch.
- Web/Admin/KDS: continuous (after staging passes).
- POS: bi-weekly (staged rollout 72h).
- Mobile: bi-weekly native via EAS; OTA JS via EAS Update mid-cycle.

## 14. Feature Flags

Unleash (self-hosted) with strategies: per-role, per-branch, per-channel, gradual rollout %, kill switch. Flags documented in `flags.md` with owner and sunset date.
