# 07 — Security Architecture

## 1. Threat Model (STRIDE summary)

| Threat | Vector | Mitigation |
|---|---|---|
| Spoofing | Stolen credentials, replay tokens | MFA for staff, refresh-token rotation + reuse detection, device fingerprinting |
| Tampering | Modified order on the wire | TLS 1.2+, HSTS, signed webhooks, integrity checksums on POS sync payloads |
| Repudiation | "I didn't refund that" | Append-only audit_logs with actor, before/after, request id |
| Info disclosure | PII leak, plaintext logs | Pino redactor (phone, email, addresses); KMS-encrypted at rest; no PII in URLs |
| DoS | Card-testing, scraping, Ramadan surge | WAF + Cloudflare rate limiting + per-route limits + queue backpressure + autoscale |
| Elevation | Cashier escalating to manager actions | Strict RBAC; manager PIN gate for sensitive ops; signed elevation tokens |

## 2. Authentication

- **Customer:** OTP-first (KSA habit). Optional email/password set later.
- **Staff:** email or employeeId + password + (optional) TOTP MFA; SuperAdmin MFA mandatory.
- **Drivers:** in-app login binds to a registered device; remote revoke from admin.
- **Service-to-service (worker → API):** signed JWT with short TTL, service-account roles.

JWT signing: RS256 with KMS-stored private key. Public key exposed at `/auth/jwks.json` for SDKs.

Refresh token rotation per OWASP cheatsheet:
- One-time use.
- Family lineage tracked; reuse → entire family revoked.
- Stored as SHA-256 hash with `userId, deviceId, family, ip, ua`.

## 3. Authorization (RBAC + ABAC)

- **Roles** = primary axis (see SDD §RBAC).
- **Attributes** layered: branchId scoping, time-of-day windows for cashier overrides, geo for delivery drivers (can only view orders within X km).
- **Middleware chain:** `auth → tenant → branchScope → rbac(action)`.
- Per-resource ABAC for fine-grained ("customer can only read own orders") via `policy(...)` decorators in services.

## 4. Data Protection

| State | Mechanism |
|---|---|
| In transit | TLS 1.3 preferred, min 1.2; HSTS preload; mTLS for ZATCA, payment webhooks (provider-permitting) |
| At rest (DB) | Mongo Atlas encrypted with customer-managed KMS key |
| At rest (S3) | SSE-KMS |
| Secrets | AWS Secrets Manager + IAM short-lived roles via IRSA |
| Backups | Encrypted; cross-region; restore tested quarterly |
| PII fields | Phone & email tokenized (HMAC-SHA256 with rotating pepper) for search; raw value encrypted with field-level envelope encryption |
| Card data | **Never stored**. Tokens-only from gateway; PCI-DSS SAQ A scope |

## 5. OWASP ASVS L2 Compliance Checklist (excerpt)

- V2 Authentication: ✓ password policy, ✓ MFA, ✓ secure recovery, ✓ session timeout, ✓ rotation
- V3 Session Mgmt: ✓ secure JWT, ✓ refresh rotation, ✓ revocation
- V4 Access Control: ✓ RBAC + ABAC enforced server-side
- V5 Validation: ✓ Zod whitelist validation everywhere; mass-assignment prevention via DTO mapping
- V7 Cryptography: ✓ KMS, no DIY crypto
- V8 Data Protection: ✓ encryption at rest/in transit
- V9 Comms: ✓ TLS configuration scored A+ via Mozilla observatory
- V10 Malicious Code: ✓ SCA (Snyk/Dependabot), Trivy on images
- V11 Business Logic: ✓ idempotency, ✓ transaction integrity, ✓ state machine
- V12 Files: ✓ MIME sniffing, ✓ S3 pre-signed uploads
- V13 API: ✓ rate-limited, ✓ versioned, ✓ documented

Annual third-party pen test (CREST-accredited). Findings tracked in JIRA with SLA: Critical 24h, High 7d, Medium 30d.

## 6. Input Validation

- All boundaries validated by Zod schemas in `packages/validators` — same schemas reused on client.
- Express body limit 1 MB (10 MB only on image upload route).
- File uploads:
  - Pre-signed S3 PUT URL; max size enforced at signing.
  - Mime + magic-byte sniff server-side post-upload.
  - Anti-virus scan (ClamAV sidecar) before exposure.

## 7. Rate Limiting

- Redis-backed sliding window via `rate-limiter-flexible`.
- Buckets per IP, per user, per route group (see doc 06 §19).
- 429 responses include `Retry-After`.
- Auth + payment routes have hard daily caps to thwart card-testing.

## 8. Audit Logging

- All state-mutating endpoints audit-log via `auditMiddleware`.
- Captured: actor, ip, ua, request id, route, target, before/after (sanitized), latency, outcome.
- Append-only; 13-month online, 7y cold archive.
- Tamper-evident: nightly job computes hash chain across audit shard; chain root written to immutable S3 Object Lock.

## 9. Secrets & Key Management

- AWS KMS keys per environment, per purpose (`mv-jwt-sign-prod`, `mv-mongo-prod`, `mv-s3-prod`).
- Auto-rotate annually for symmetric; JWT signing key annually with `kid` grace window.
- Local dev: per-developer `.env.local`, never committed; pre-commit hook (`trufflehog`) blocks secrets in commits.

## 10. Privacy & Compliance

- **KSA PDPL:** lawful basis declared per processing purpose; consent ledger; data subject request flow (`/customers/:id/anonymize`, `/customers/:id/export`).
- **ZATCA Phase-2 e-invoicing:** invoice clearance + QR + cryptographic stamp; chain of invoices per branch.
- **SFDA nutrition labelling:** calorie info attached at product level; surfaced on web/app.
- **PCI-DSS:** SAQ A — no card data touches our systems.
- **Cookie consent** on website, with strict/marketing categories.

## 11. Application Security Headers

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; img-src 'self' data: https://*.cloudflare.com;
                          script-src 'self' 'sha256-...'; frame-ancestors 'none';
                          connect-src 'self' https://api.manhattanvibes.sa wss://api.manhattanvibes.sa
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(self), camera=(), microphone=()
X-Frame-Options: DENY
```

## 12. CORS

Allowlist: `manhattanvibes.sa`, `app.manhattanvibes.sa`, `admin.manhattanvibes.sa`, `pos.manhattanvibes.sa` (intranet IP allowlist additionally), POS Electron uses custom origin `app://manhattan-pos`.

## 13. Mobile App Security

- Certificate pinning (Expo cert-pinning module).
- Jailbreak/root detection → degraded mode.
- Keychain/Keystore for tokens; no AsyncStorage for sensitive data.
- App attestation (DeviceCheck / Play Integrity) on sensitive endpoints (payment intent, OTP).
- Code obfuscation (Hermes + Proguard).

## 14. POS Security

- Windows kiosk policy locks down OS.
- BitLocker disk encryption.
- Local SQLite encrypted (SQLCipher).
- Per-device certificate for mTLS to API (issued at provisioning).
- Auto-update signed with code-signing cert.
- Cashier PIN for shift control; manager PIN for refunds > threshold.

## 15. Driver App Security

- One-time device binding via QR provisioning in branch.
- Customer phone shown only after pickup (privacy); contact via masked-number bridge (Twilio / Unifonic).
- Location collected only during active job.

## 16. Incident Response

- 24/7 PagerDuty rotation (Codlight ops).
- SEV1 (data breach, prod outage): incident commander + comms lead + tech lead; status page updated within 15 min.
- Post-mortem within 5 business days; blameless template.
- Tabletop exercise quarterly.

## 17. Vulnerability Management

| Source | Cadence |
|---|---|
| Dependabot + Snyk | Continuous |
| Trivy scan (container) | Per PR + nightly |
| SAST (CodeQL / Semgrep) | Per PR |
| DAST (OWASP ZAP) | Weekly against staging |
| Pen test | Annual + after major releases |
| Bug bounty (HackerOne private) | Continuous (post-launch) |

## 18. Logging & Privacy in Logs

Redactor rules in Pino:
```ts
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'req.body.password',
    'req.body.cardNumber',
    'req.body.cvv',
    'req.body.otp',
    'user.phone.number',
    'user.email',
  ],
  censor: '[REDACTED]'
}
```

No PII in URLs. Customer phone never in query strings. All correlation by `requestId` UUID.
