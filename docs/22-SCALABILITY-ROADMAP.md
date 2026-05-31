# 22 — Future Scalability & Roadmap

> 12 / 24 / 36 month evolution beyond Phase 1.

## 1. Guiding Principles

- **Modularity over rewrites.** Each module is independently scalable; refactor in place.
- **Data > opinion.** Every roadmap bet must come with a leading indicator we'll measure.
- **Customer-visible value first.** Internal refactors only when blocking customer value or risk.
- **Cost-conscious.** Each new tech earns its keep; sunset what doesn't.

## 2. Roadmap by Quarter (post-go-live)

### Q1 — Stabilization & Polish (M+0 to M+3)

- Defect cleanup from hypercare.
- POS hardware certification with 2 more terminal models.
- Performance: cache hit rates, query optimization.
- A/B testing harness in web/mobile.
- App store optimization (ASO).
- Aggregator integration foundations (HungerStation, Jahez, ToYou) — webhook listeners + adapter pattern.

### Q2 — Aggregator Integrations & Self-Service Kiosks (M+3 to M+6)

- HungerStation, Jahez, ToYou integrations behind unified `AggregatorAdapter` interface.
- Self-service kiosk app (PWA-based, Electron-deployable to 21" touchscreens) shares pizza builder with web.
- WhatsApp ordering (template-driven via 360dialog) as a chat surface.
- Refined VIP experience: priority kitchen flag visible on KDS for Platinum tier.

### Q3 — Analytics Warehouse & Personalization (M+6 to M+9)

- Introduce PostgreSQL/BigQuery + dbt for offline analytics & BI.
- Streaming pipeline (Kafka or Mongo Change Streams → Kinesis) to feed warehouse.
- Customer recommendations on web/app (collaborative filtering baseline).
- Marketing automation upgrades (multi-touch journeys).
- Cohort-based forecasting for demand planning.

### Q4 — GCC Expansion (M+9 to M+12)

- Multi-tenant capability lift (currently single tenant). Add `tenantId` everywhere already present in schema → fully validate isolation.
- UAE, Kuwait, Bahrain market readiness (currency, payment gateways, tax rules — UAE VAT 5%, Kuwait none, Bahrain 10%).
- Per-country payment providers, tax compliance.
- Multi-region active-active for data residency (KSA, UAE).
- Driver app extensions for cross-country logistics.

### Year 2 — Scale & AI

- Demand forecasting per branch per ingredient → automated PO drafts.
- Dynamic pricing rules (off-peak discounts).
- Voice ordering (Alexa/Google) — Phase 1 cart sync.
- Computer-vision-based kitchen quality control (optional pilot).
- Robotic kitchen integration prep (extensibility for future Manhattan Vibes Lab).
- Loyalty 2.0: gamification, challenges, family accounts.

### Year 3 — Platform & Ecosystem

- Franchisee portal (multi-tenant + financial split).
- Public API + partner program (catering integrations).
- ML-based driver routing improvements.
- Drone delivery pilot (regulatory permitting).
- Native AR menu (try-before-you-order).
- Carbon-impact reporting per order (sustainability).

---

## 3. Technical Evolution

### 3.1 Database

- Phase 1: Mongo Atlas M40+ with read replicas.
- Phase 2: shard on `tenantId` (lazy — only if vertical scaling exhausts).
- Phase 2: introduce PostgreSQL for OLAP + BI / large reports.
- Phase 3: BigQuery / Snowflake for petabyte-scale analytics, ML.

### 3.2 Eventing

- Phase 1: BullMQ + Socket.IO + internal eventbus.
- Phase 2: introduce Kafka (MSK) or NATS JetStream when:
  - We need replay for new consumers
  - Throughput >10k events/sec sustained
  - Multi-team consumers (partner integrations)
- Domain events are already shaped Kafka-friendly (typed envelope with `eventVersion`).

### 3.3 Services Split

- Currently a modular monolith (M1 API).
- Split candidates (when team & traffic justify):
  - Payment service (PCI scope isolation)
  - Notification service (high fan-out)
  - Loyalty (custom rules engine)
  - Search (Elasticsearch-backed)
- Strangler-fig migration via service mesh; never big-bang.

### 3.4 Search

- Phase 1: Mongo text index.
- Phase 2: Elasticsearch/OpenSearch for catalog search, customer/order search at scale.

### 3.5 Edge & Performance

- Cloudflare Workers for catalog cache at edge (sub-50ms globally).
- Image CDN with on-the-fly resize (Cloudflare Images).
- HTTP/3 (QUIC) everywhere.
- Streaming SSR with React Server Components for richer interactive pages.

### 3.6 Mobile

- Adopt Expo Router fully if maturity proves.
- Migrate to Skia for richer pizza-builder animations.
- Consider Liveness on biometrics for higher-value transactions.

### 3.7 POS

- Move toward conflict-free replicated data types (CRDTs) for table state and inventory adjustments — preempts the "edge sync node" gap.
- Native mode (electron-builder + V8 isolates) for older POS hardware as needed.
- Self-test harness running nightly per terminal (printer/test, reader/test, sync round-trip).

### 3.8 Observability

- SLO error-budget burn alerts (replace static alerts).
- Distributed tracing across mobile → API → DB.
- Cost observability (Vantage/CloudCost) per feature flag.

### 3.9 Security

- Move JWT signing key into HSM (CloudHSM) at scale.
- mTLS pod-to-pod (Istio / Linkerd).
- Customer device attestation expanded.
- Bug bounty program graduates from private to public.

---

## 4. Capacity Targets (Year 3 horizon)

| Metric | Y1 target | Y3 target |
|---|---|---|
| Branches | 25 | 150 |
| Active customers | 250k | 2M |
| Orders / day | 8k | 80k |
| Peak orders / min | 600 | 5,000 |
| API RPS | 2,500 | 25,000 |
| Mobile installs | 500k | 4M |
| Markets | KSA | KSA + UAE + KW + BH + QA + OM |

Infrastructure scales sub-linearly in cost via reserved capacity, edge caching, and per-tenant isolation.

---

## 5. Decommissioning Watch List

- **Phase 1 Mongo text search** → replaced by Elasticsearch in Phase 2.
- **Phase 1 Socket.IO Redis adapter** → reevaluate vs Centrifugo at higher scales.
- **Phase 1 Mongo analytics rollups** → migrated to warehouse in Phase 2.
- **Initial PDF rendering via Playwright** → consider Gotenberg or specialized service.
- **Single-region cluster** → multi-region active-active.

---

## 6. Risks & Watchpoints

| Risk | Watch | Trigger |
|---|---|---|
| Mongo write-throughput ceiling | replicaSet ops/sec | >60% sustained → plan shard |
| Aggregator dependence growing | aggregator % share | >40% → renegotiate or invest in direct channels |
| Privacy regulation change (PDPL evolution) | regulatory feed | reassess every 6 months |
| Payment rail change (Mada/STC) | vendor advisories | quarterly review |
| Talent retention | team telemetry | quarterly engagement survey |
| Vendor lock-in (cloud, gateway) | review | annual exit-feasibility check |

---

## 7. Innovation Pipeline (10% time)

Engineers reserve 10% capacity for spikes:
- Customer-facing LLM concierge (RAG over menu + offers).
- Voice ordering experiments.
- Kitchen activity-tracking (vision).
- Driver dispatch ML.

Outcomes graduate to roadmap only with evidence.

---

## 8. Sustainability

- Track CO₂e per order (delivery distance + packaging).
- Customer-visible "sustainability score" by Y3.
- Packaging vendor reviews annually.
- Driver electrification pilot Y2 in metro areas.

---

This roadmap is a living document. Quarterly business review revises based on metrics, market shifts, and customer signal.
