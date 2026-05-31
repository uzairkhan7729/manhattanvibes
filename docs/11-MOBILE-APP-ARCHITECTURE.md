# 11 — Mobile App Architecture

> React Native (0.76 new architecture) + Expo SDK 52 + TypeScript. iOS 14+, Android 9+. Two apps: **Customer** (public) and **Driver** (internal). This doc focuses on the Customer app; Driver shares the foundation, scope detailed in §13.

## 1. Stack

| Concern | Tool |
|---|---|
| Framework | React Native 0.76 (Hermes) |
| Tooling | Expo SDK 52, EAS Build, EAS Update |
| Nav | React Navigation 7 (stack + tabs + drawer) |
| State | Redux Toolkit + RTK Query |
| Local | MMKV (sync KV), expo-sqlite (history cache) |
| Forms | React Hook Form + Zod |
| Maps | react-native-maps (Apple on iOS, Google on Android) |
| Push | expo-notifications (APNs + FCM) |
| Payments | Stripe RN SDK (cards/Apple Pay), STC Pay native module, Mada via HyperPay SDK |
| Biometrics | expo-local-authentication |
| Crashes | Sentry RN |
| Analytics | Firebase + Meta SDK |

## 2. Folder Structure

```
apps/mobile/
├── app.config.ts                 # Expo config (dynamic, env-aware)
├── eas.json                      # build profiles: development, preview, production
├── src/
│   ├── App.tsx
│   ├── navigation/
│   │   ├── RootNavigator.tsx
│   │   ├── AuthStack.tsx
│   │   ├── MainTabs.tsx
│   │   └── linking.ts           # deep links / universal links
│   ├── screens/
│   │   ├── auth/                # Welcome, Phone, OTP, Profile-setup
│   │   ├── home/
│   │   ├── menu/
│   │   ├── pizza-builder/
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── track/
│   │   ├── orders/
│   │   ├── loyalty/
│   │   ├── wallet/
│   │   ├── profile/
│   │   └── settings/
│   ├── components/
│   ├── services/
│   │   ├── api.ts               # RTK Query base
│   │   ├── push.ts
│   │   ├── location.ts
│   │   ├── payment/
│   │   │   ├── stripe.ts
│   │   │   ├── applepay.ts
│   │   │   └── stcpay.ts
│   │   └── analytics.ts
│   ├── store/                   # Redux slices
│   ├── i18n/
│   ├── theme/
│   ├── utils/
│   └── types/
└── assets/                       # fonts, icons, lottie animations
```

## 3. Navigation Map

```
RootNavigator
├── (unauth) AuthStack
│   ├── Welcome
│   ├── PhoneEntry
│   ├── OtpVerify
│   ├── ProfileSetup
│   └── LanguagePick
└── (auth) MainTabs
    ├── Home tab
    │   └── stack: Home, Promotions, Search
    ├── Menu tab
    │   └── stack: Categories, ProductDetail, PizzaBuilder, Cart, Checkout, Tracking
    ├── Orders tab
    │   └── stack: OrderList, OrderDetail, Reorder, Feedback
    ├── Loyalty tab
    │   └── stack: LoyaltyHome, Tiers, RewardsCatalog, Wallet, Referrals
    └── Profile tab
        └── stack: Profile, Addresses, PaymentMethods, Notifications, Settings, Support, Logout
```

Deep links: `manhattanvibes://order/{id}`, `manhattanvibes://promo/{code}` and HTTPS universal links via `applinks` / `assetlinks`.

## 4. Data Layer

- RTK Query slice per domain: `catalog`, `orders`, `customer`, `loyalty`, `promotions`, `branches`.
- Query cache lifetime 60s default, manually invalidated on writes.
- Offline cart in MMKV; resumable.
- Order history paged with cursor pagination; cached for offline view.

## 5. Authentication

- OTP-first.
- Sign in with Apple mandatory (iOS App Store).
- Google Sign-In via expo-auth-session.
- Tokens stored in iOS Keychain / Android Keystore via `expo-secure-store`.
- Auto-refresh via RTK Query baseQuery wrapper.
- Biometric re-auth for opening sensitive screens (wallet, payment methods).

## 6. Push Notifications

- Token registered on login; sent to `POST /notifications/devices`.
- Channels (Android 8+): `orders`, `promos`, `loyalty`, `support`.
- Categories (iOS): with actions (e.g., "Reorder", "View tracking").
- Silent push to refresh order state badge.
- Topic subscriptions: `branch:RUH-1` for branch-specific promos (opt-in).

## 7. Payments

- **Apple Pay:** native sheet via Stripe RN SDK; merchantIdentifier registered.
- **Google Pay:** Stripe RN SDK (Android-only; KSA: Mada-enabled tokens supported by Stripe in some markets — fallback to HyperPay if not).
- **Mada / Visa / MC:** in-app HyperPay COPYandPAY widget OR Moyasar embedded form. Tokenization only; PCI scope SAQ A-EP.
- **STC Pay:** native module wrapping their SDK; deep-links back to app on success.
- **Wallet:** the app's "Wallet" is a customer credit balance held on server; redeemed at checkout.

## 8. Location

- Foreground only by default; background only when actively tracking an out-for-delivery order (transparent prompt).
- Address-from-pin selection with Mapbox / Apple Maps geocoder.
- Saved addresses linked to coords; auto-fill on next checkout.

## 9. Live Tracking

- Same Socket.IO `/tracking` namespace as web.
- Order stepper + map with driver pin.
- Foreground-service on Android while tracking; iOS uses silent pushes + foreground updates.

## 10. Performance

- App size budget: <60 MB iOS / <40 MB Android (after Hermes + Proguard).
- Cold start <2.5s P50.
- Image caching via `expo-image`.
- Animations via Reanimated 3 worklets, no JS-thread jank.
- Hermes + JSI, no remote-debugger ship build.

## 11. Internationalization

- `i18n-js` + ICU MessageFormat.
- RTL switch via `I18nManager.forceRTL`; restart prompt on language change.
- Locale-aware number/date formatting via Intl.

## 12. Offline / Degraded

- Last-known-good catalog cached.
- Cart usable offline; checkout requires network (gracefully blocked).
- Saved orders & loyalty viewable offline.
- Banner indicates connectivity loss.

## 13. Driver App (separate Expo project, shared packages)

Differences from Customer:
- No catalog/cart.
- Screens: Job List, Active Job (with map turn-by-turn), Proof-of-Delivery (photo / signature / OTP), Earnings, Shift control.
- Permanent foreground service for GPS during active job.
- Battery-optimized: 5s GPS interval when moving, 30s when stationary.
- Manager force-logoff supported.
- Internal app — distributed via TestFlight + Play Internal track; QR-scan device binding at branch.

## 14. Distribution & Updates

- Native binary updates: bi-weekly via EAS Build → TestFlight → App Store / Play Console.
- JS bundle hot-fixes mid-cycle via EAS Update (per release channel).
- Force-upgrade gate via `/health/min-versions` returning min `(buildNumber, jsVersion)`; older clients show update modal.

## 15. Compliance

- Apple App Privacy labels: explicit categories.
- Google Data safety form filled.
- Tracking permission (ATT) prompt on iOS before any IDFA usage.
- Children's data: explicit "you must be 13+" gate in registration.
- KSA PDPL: privacy policy + DSR endpoint linked from app settings.

## 16. Crash & Quality Gates

- Sentry RN with release tracking.
- Crash-free sessions target >99.5%.
- Detox E2E suite (registration, place order, track, redeem points) gating EAS builds.
- Storybook for native components on web (`react-native-web`).
