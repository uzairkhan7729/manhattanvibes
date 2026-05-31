# 17 — Notification Architecture

> Unified send-anything service. Producers (services, workflows) emit a single "send" request; the service routes to the right provider per channel + per recipient preferences.

## 1. Channels & Providers

| Channel | Primary | Fallback | KSA notes |
|---|---|---|---|
| Push (mobile) | Expo Push (which fan-outs to FCM + APNs) | Direct FCM/APNs SDK | per-device tokens |
| SMS | Unifonic | Taqnyat / CEQUENS | Requires CITC-approved sender ID; OTP and marketing separate IDs |
| Email | AWS SES (KSA region) | Postmark | DKIM/SPF/DMARC enforced |
| WhatsApp | 360dialog (Meta BSP) | Twilio | Template approval per locale |

## 2. Architecture

```
[Producer (service / cron / workflow)]
       │
       ▼ NotificationService.send({ recipient, channels[], templateKey, vars, priority })
       │
   ┌───┴────────────────────────┐
   │ Resolve preferences         │
   │ Resolve template (per loc.) │
   │ Render variables             │
   │ Suppression list check       │
   │ Frequency cap check          │
   │ Quiet-hours check            │
   └───┬────────────────────────┘
       │
       ▼ enqueue (BullMQ on Redis) per channel
       │
   ┌───┴─────────┬─────────────┬────────────┐
   │ pushWorker  │ smsWorker   │ emailWorker│ waWorker
   └───┬─────────┴───┬─────────┴────┬───────┘
       │             │              │
       ▼             ▼              ▼
   FCM/APNs     Unifonic        SES        Meta WA
       │             │              │              │
       ▼ delivery callbacks / webhooks (where supported)
   notification_deliveries table updated
```

## 3. Templates

Stored in `notification_templates` collection:

```ts
{
  key: 'order.confirmed',
  channel: 'push'|'sms'|'email'|'whatsapp',
  locale: 'ar'|'en',
  subject?: 'Order #{{orderNumber}} confirmed', // email/push title
  body: 'Hi {{firstName}}, your order #{{orderNumber}} is confirmed. ETA {{etaMinutes}} min.',
  vars: ['firstName', 'orderNumber', 'etaMinutes'],
  isTransactional: true|false,         // transactional bypasses marketing opt-out
  zatcaSafe: false,                    // certain channels require pre-approval (WA templates)
}
```

Edited via admin portal; versioned; preview & test-send supported.

## 4. Standard Notifications

| Event | Channels | Transactional? |
|---|---|---|
| OTP verification | SMS | yes |
| Welcome (signup) | email, push | no (marketing) |
| Order confirmed | push, sms, email | yes |
| Kitchen accepted | push | yes |
| Out for delivery + ETA | push | yes |
| Driver nearby | push | yes |
| Delivered | push | yes |
| Refund initiated | push, sms | yes |
| Low loyalty points expiring | push, email | no |
| Tier upgraded | push, email | no (but allowed under loyalty-info bucket) |
| Birthday reward | push, email, sms | no |
| Marketing campaign | push, sms, email, wa | no |
| Inventory low (manager) | push, email | yes (operational) |
| Failed delivery (manager) | push, sms | yes |

## 5. Preferences Model

Per customer:
```ts
marketingPrefs: { sms: bool, email: bool, push: bool, whatsapp: bool }
```
Transactional notifications **always** go through (legally required for tax invoices, order updates).

## 6. Frequency Caps & Suppression

- Marketing: max 2 per channel per customer per 7d (config).
- Suppression list (global): emails or phones that bounced/complained 3 times; manual entries.
- One-click unsubscribe links (email); STOP keyword (SMS, KSA-compliant); per-channel opt-out in app.
- Quiet hours: no marketing SMS/push between 22:00–08:00 Asia/Riyadh.

## 7. Push Specifics

- Device tokens registered at login: `POST /notifications/devices` with `{ token, platform, locale, appVersion }`.
- Tokens auto-revoked on logout and on uninstall (we observe `not-registered` from FCM/APNs and purge).
- Categories (iOS) and channels (Android 8+): separate buckets `orders`, `promos`, `loyalty`, `support`.
- Silent push for cache refreshes (e.g., menu update).

## 8. SMS Specifics

- Separate sender IDs for OTP (`MV`) and marketing (`MV-PROMO`).
- 160-char-aware (Arabic = 70 char/segment); cost-aware.
- OTP messages plain numeric, no links — to avoid carrier filters.
- DLR (delivery report) tracked.

## 9. Email Specifics

- SES KSA or SES Bahrain.
- Email templates: MJML → HTML, dark-mode compatible.
- Tracking pixel optional (PDPL consent).
- Inbound bounce handling via SNS → worker → suppression list.

## 10. WhatsApp Specifics

- Template-based; pre-approved per locale by Meta.
- Use cases: order confirmation, OTP (where available), customer support replies (24h window).
- Conversation pricing applies; we track per-conversation costs.

## 11. Observability

- `notifications` collection acts as send log; status `queued|sent|failed|delivered|bounced|complained`.
- Dashboard: delivery rate by channel, latency, opt-out rate, click-through (where measurable).
- Alert: spike in bounces/complaints → auto-pause sender.

## 12. Failure Modes

| Failure | Behavior |
|---|---|
| Provider down | retry with backoff; after 3 fails, route to fallback provider |
| Bad template variable | log error, fall back to plain text without that variable |
| User unreachable on preferred channel | try next channel from order: push → sms → email |
| Cost cap exceeded | block marketing sends with admin alert; transactional unaffected |

## 13. Multi-Language

Templates exist per `locale ∈ {ar, en}`. Recipient's `preferredLanguage` chooses; fallback `ar`. Fallback template gets `[EN]` prefix if AR missing.

## 14. APIs

See [06-API-SPECIFICATION.md §13](06-API-SPECIFICATION.md).
