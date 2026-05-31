# 20 — Testing Strategy

> Quality is owned by every engineer; QA accelerates and verifies. Test pyramid: many unit, fewer integration, fewer E2E, few exploratory/manual.

## 1. Levels

| Level | Tool | Owner | When |
|---|---|---|---|
| Unit | Vitest / Jest | dev | Every PR |
| Integration (API + DB + Redis) | Vitest + Supertest + Testcontainers | dev | Every PR |
| Contract | Pact | dev | Every PR |
| E2E web | Playwright | dev/QA | Per PR + nightly |
| E2E mobile | Detox | QA | Nightly |
| E2E POS | Playwright (Electron) | QA | Pre-release |
| Visual regression | Chromatic / Percy | dev | Per PR |
| Performance | k6 + Lighthouse CI | DevOps | Nightly + per release |
| Security | Snyk + Trivy + Semgrep + ZAP | DevOps | Per PR + weekly |
| Accessibility | axe-core CI + manual | dev/UX | Per PR |
| Chaos | Litmus / chaos-mesh | DevOps | Quarterly |

## 2. Coverage Targets

| Module | Statement coverage |
|---|---|
| API | ≥80% |
| Client apps (web/mobile/admin/pos/kds) | ≥70% |
| Shared packages | ≥90% |
| Critical files (payment, sync, auth) | ≥95% |

Coverage measured by CI, gating merge.

## 3. Unit Test Conventions

- Pure functions: many cheap tests.
- Mock external deps at the seam (HTTP, time).
- `describe('OrderService', () => { it('rejects past-cutoff modification', ...) })`.
- Use Zod schemas to generate fuzz inputs (fast-check + Zod adapter).

## 4. Integration Tests

- Real Mongo (Testcontainers), real Redis (Testcontainers), in-process Express.
- Tear-down/setup per test file; fixtures reset between tests.
- Time travel via `Clock` provider.
- Webhook contract: replay captured payloads from sandbox of HyperPay/Moyasar/STC Pay.

## 5. Contract Tests

- API exposes OpenAPI spec; consumers (web, mobile, admin, pos) generate clients from it.
- Pact verifies provider against consumer expectations on each merge.
- Schema-breaking changes blocked at CI.

## 6. E2E

### 6.1 Web (Playwright)

Golden journeys:
1. New customer signup via OTP → place delivery order → pay (Apple Pay sandbox) → track → delivered.
2. Returning customer reorder with loyalty redemption.
3. Coupon validation success + failure.
4. Pickup order flow.
5. RTL layout sanity (key screens).

Run against staging on merge to `main`; nightly against prod-like.

### 6.2 Mobile (Detox)

Golden journeys mirror web; plus push-notification triggered flows; biometrics unlock; offline graceful handling.

### 6.3 POS (Playwright + Electron)

Golden journeys:
1. Cashier opens shift → places dine-in order → splits bill → closes order.
2. Network drop → offline order → sync recover.
3. Manager refund flow.
4. Table merge & split.
5. Receipt + kitchen print via virtual printer.

### 6.4 KDS

Mock socket server; verify bump flow, SLA escalation, station filtering.

## 7. Performance Testing (k6)

Scenarios:
| Scenario | Target | Pass criteria |
|---|---|---|
| Catalog read | 1000 RPS / 5 min | P95 < 200ms; error rate < 0.1% |
| Place order (auth + create + pay-stub) | 200 RPS / 10 min | P95 < 600ms; error rate < 0.5% |
| Realtime fan-out | 5,000 sockets, 10 msg/s/branch | server CPU < 70%; lag < 1s |
| Ramadan peak simulation | 5× baseline ramping 30 min | autoscale healthy; SLOs met |

Run nightly against staging; full peak sim before Ramadan.

Lighthouse CI: web LCP <2.0s, CLS <0.1, TBT <200ms; mobile (Lighthouse mobile profile).

## 8. Security Testing

- SAST: Semgrep + CodeQL on every PR.
- SCA: Snyk + Dependabot.
- Container: Trivy.
- DAST: OWASP ZAP weekly against staging; full pen-test annually + post-major-release.
- Secret scan: TruffleHog pre-commit.
- Threat model review per major feature (auth changes, payment changes, sync changes).

## 9. Accessibility

- axe-core in unit + Playwright runs (`@axe-core/playwright`).
- Manual screen-reader smoke (VoiceOver iOS / TalkBack Android) once per release.

## 10. Test Data Management

- Seed scripts produce branches, categories, products, customers, sample orders for each environment.
- PII never copied from prod to lower envs without scrubbing pipeline.
- Realistic data sizes in staging (~12 months historical) for performant query testing.

## 11. Chaos Engineering

Quarterly drills against staging:
- Kill primary Mongo → verify failover < 30s.
- Kill Redis → verify cache fallback and graceful degradation (queues should retry).
- Block payment gateway → verify queue + fallback gateway switch.
- Kill an AZ → verify pod rescheduling.
- ZATCA endpoint timeout → verify 24h queued grace.

## 12. CI Workflow Sequence

```
PR opened
 ├─ lint, typecheck, unit, integration, build (parallel)
 ├─ Trivy fs, Semgrep, Snyk
 ├─ contract test (Pact provider verify)
 ├─ Playwright web (smoke)
 ├─ Lighthouse CI (web)
 ├─ Coverage gate
 └─ All green → reviewable

On merge to main
 ├─ Build images
 ├─ Push to ECR with `staging` tag
 ├─ ArgoCD syncs to staging
 ├─ Smoke suite against staging
 └─ Notify QA channel

Tag v* push
 ├─ Build prod-tagged images
 ├─ Deploy staging-final
 ├─ Manual approval
 ├─ Deploy prod
 └─ Post-deploy smoke + canary metrics watch
```

## 13. Bug Lifecycle

| Severity | Definition | Response time | Resolution |
|---|---|---|---|
| SEV1 | Outage / data loss / payment failure | <15 min ack | <4h fix or rollback |
| SEV2 | Major feature broken | <1h ack | <24h |
| SEV3 | Minor feature broken | <1 day | <1 week |
| SEV4 | Cosmetic | <3 days | next release |

Triage daily; postmortems for SEV1 within 5 business days.

## 14. Test Documentation

- `tests/README.md` covers how to run all suites locally.
- Test plans per epic linked from JIRA tickets.
- UAT scripts (doc 21) maintained alongside.
