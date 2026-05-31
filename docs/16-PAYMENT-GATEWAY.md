# 16 — Payment Gateway Design

> Saudi Arabia focused. Phase 1 supports Mada, Visa, MasterCard, Apple Pay, STC Pay, and cash (POS).

## 1. Gateway Selection

| Gateway | Coverage | Reason |
|---|---|---|
| **HyperPay** (primary) | Mada, Visa, MC, Apple Pay, STC Pay | Strong KSA presence, single integration |
| **Moyasar** (fallback / A-B) | Mada, Visa, MC, Apple Pay, STC Pay | Lighter SDK, good for web |
| **Checkout.com** (international) | Visa/MC for non-KSA cards | Future expansion |

Active gateway selected per channel & branch via feature flag; runtime switch supported.

## 2. Method Matrix

| Channel | Mada | Visa/MC | Apple Pay | STC Pay | Cash |
|---|---|---|---|---|---|
| Web | ✓ COPYandPAY / Moyasar form | ✓ | ✓ (Safari/iOS) | ✓ deep-link/QR | — |
| Mobile (iOS) | ✓ HyperPay SDK | ✓ Stripe RN | ✓ Native sheet | ✓ Native | — |
| Mobile (Android) | ✓ HyperPay SDK | ✓ Stripe RN | — | ✓ Native | — |
| POS | ✓ Terminal (Geidea/Pax) | ✓ Terminal | ✓ NFC on terminal | ✓ QR scan | ✓ |

## 3. Online Payment Flow (App / Web)

```
Customer taps "Pay"
   │
   ▼ POST /payments/intent { orderId, method }
API ─ creates Payment{ status='authorized_pending' }
    ─ calls gateway.createCheckout({ amount, orderId, currency: 'SAR', return_url })
    ─ returns { checkoutId, redirectUrl | sdkParams }
   │
   ▼ Client renders gateway widget or invokes SDK
Customer completes 3DS (Mada/Visa/MC) or biometric (Apple Pay)
   │
   ▼ Gateway → callback (browser redirect) AND signed webhook to /payments/webhook/:gateway
API ─ verifies HMAC signature
    ─ updates Payment{ status='captured', gatewayRefs }
    ─ updates Order{ paymentStatus='paid', state→CONFIRMED }
    ─ emits order.confirmed
   │
   ▼ Client polls or receives Socket.IO event → tracking screen
```

3DS is **always** enabled for cards (per Saudi card scheme rules).

## 4. POS Payment Flow

```
Cashier presses "Pay" → "Card"
POS sends amount to integrated terminal (OPI / Sunmi SDK)
Terminal prompts customer (insert/tap), gets auth from Mada/issuer
Terminal returns { approved, authCode, last4, txnId } to POS
POS records PAYMENT_CAPTURE op (offline-safe via outbox)
   │ when online
   ▼ /sync → server records Payment + updates order paymentStatus
```

For Apple Pay on POS: terminal supports NFC; same flow.
For STC Pay on POS: QR shown on terminal; customer scans with STC Pay app; terminal polls for confirmation.

## 5. Split Payment

`POST /orders/:id/transition?action=split-pay` supports multiple `Payment` records summing to total. Each captured independently. If any leg fails, prior captured legs auto-void (best-effort) and order reverts to `payment.partial` with manager UX to retry.

## 6. Refunds

- Initiated from admin or POS.
- Manager approval gates:
  - ≤ 200 SAR — cashier
  - 200 – 1000 SAR — branch manager
  - \> 1000 SAR — head-office finance
- Refund issued via same gateway and same payment method (regulator requirement).
- Cash refund recorded against cash drawer.
- Refunds reverse loyalty points proportionally.
- Refund webhook updates `Payment.refunds[]`.

## 7. Webhooks

`POST /payments/webhook/:gateway` — HMAC-verified (gateway-specific signing).

Events: `payment.authorized`, `payment.captured`, `payment.failed`, `payment.refunded`, `chargeback.received`.

Idempotency via `gatewayRefs.txnId` unique index. Retries from gateway tolerated.

## 8. Failures & Reconciliation

- **Failure UX:** clear reason mapped from gateway code; one-tap retry; switch method offered.
- **Daily reconciliation:** workers pull settlement files from each gateway (SFTP / API), match to `Payment` records, surface discrepancies in admin "Reconciliation" report.
- **Chargebacks:** webhook creates an internal "dispute" record; ops team workflow with deadline tracking.

## 9. PCI-DSS Scope

- We are SAQ A (Mada/Visa/MC card data never traverses or is stored by our systems).
- All card data captured by gateway-hosted widgets (HyperPay COPYandPAY iframe, Stripe Elements, Apple Pay sheet).
- Tokenization for repeat customers — gateway-managed payment-method tokens stored in `customer.paymentMethods[]` with `{ token, brand, last4, expMonth, expYear }`.

## 10. ZATCA Phase-2 E-Invoicing

Every paid order produces a simplified tax invoice (B2C) or standard tax invoice (B2B, if requested):

```
order.paymentStatus = 'paid'
   │
   ▼ generate invoice XML (UBL 2.1) per ZATCA spec
   │ compute invoice hash, embed previous invoice hash (chain per branch)
   │ sign with branch's CSID-issued cryptographic stamp
   │ generate TLV-based QR per ZATCA Phase-2
   │
   ▼ POST to ZATCA Fatoora reporting/clearance endpoint (mTLS)
   │ for Standard: clearance required → embed cleared invoice
   │ for Simplified: report within 24h
   │
   ▼ persist invoice to S3 (PDF + XML) + Mongo record
   │
   ▼ attach QR to receipt (POS, web, app)
```

Degraded mode: if Fatoora down, queue invoices in `zatca_outbox`, deliver within 24h grace.

## 11. STC Pay Specifics

- Account verified via phone number registered with STC Pay.
- Web: redirect or QR.
- App: native SDK with deep-link return.
- POS: customer scans QR.
- Refunds supported.
- Settlement T+1.

## 12. Apple Pay Specifics

- Merchant ID `merchant.sa.manhattanvibes` registered.
- Domain verification for web.
- Capability declared in iOS app entitlements.
- Mada-Apple-Pay supported via HyperPay (the customer's Mada card is in their Apple Wallet).

## 13. Security Notes

- Webhook URLs unguessable (signed path), HMAC required.
- IP allowlist for webhook callers where supported.
- Customer payment method tokens encrypted at rest (envelope KMS).
- No card data in logs (Pino redactor).
- Manual replay attempt: idempotent by `gatewayRefs.txnId`.
