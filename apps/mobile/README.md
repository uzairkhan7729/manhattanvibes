# @mv/mobile — Customer Mobile App

React Native 0.81 + React 19 + Expo SDK 54 + Expo Router 6.

> The SDK version tracks **the Expo Go app currently on the App Store / Play Store**.
> Upgrade `expo` major version here when Expo ships a new SDK and you've installed
> the matching Expo Go on your phone.

## Quick start (separate workflow from the rest of the monorepo)

Mobile requires Expo CLI + Android/iOS toolchain. Install deps inside `apps/mobile`:

```powershell
cd apps/mobile

# First-time setup or after pulling SDK-version bumps: nuke the cache & lockfile
rm -r -fo node_modules; rm -fo package-lock.json
npm install
npx expo install --check   # verifies every package is on a version compatible with the installed Expo SDK

npx expo start             # press 'a' for Android emulator, 'i' for iOS sim, 'w' for web, or scan QR with Expo Go
```

The API base is read from `EXPO_PUBLIC_API_BASE`. For local development:

```powershell
$env:EXPO_PUBLIC_API_BASE = "http://YOUR-LAN-IP:8088"   # so the device/emulator can reach your API
npx expo start
```

## Routes (Expo Router file-based)

```
app/
├── _layout.tsx                 # stack
├── (tabs)/
│   ├── _layout.tsx             # bottom tabs
│   ├── index.tsx               # Home
│   ├── menu.tsx                # Category-tabbed product list + add to cart
│   ├── cart.tsx                # Cart with qty & remove
│   ├── loyalty.tsx             # Tier + points balance
│   └── profile.tsx             # Profile + order history (+ sign-out)
├── auth/
│   ├── phone.tsx               # Phone entry → request OTP
│   └── otp.tsx                 # 6-digit code → tokens + cache
├── checkout.tsx                # Order type + pay method → POST /orders + payment intent
└── track/
    └── [id].tsx                # Live tracking (5s polling; can swap to Socket.IO later)
```

## What's intentionally minimal

- **No push notifications wired** — see `docs/17-NOTIFICATIONS.md` for the design. `expo-notifications` + FCM/APNs setup is a separate sprint.
- **No payments SDK** — Phase 1 uses the sandbox gateway via the API; real Apple Pay / Mada SDK integration happens in mobile-specific sprints.
- **No real-time tracking** — Polling is good enough for v0; Socket.IO integration adds ~30 lines when ready.
- **No biometrics** — `expo-local-authentication` slot is reserved.
