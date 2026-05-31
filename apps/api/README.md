# @mv/api — Central API

Module 1 of the Manhattan Vibes ecosystem. Owns all canonical state; every other app talks to it.

## Run locally

```bash
# 1. From repo root — bring up Mongo + Redis + Mailhog + MinIO
pnpm infra:up

# 2. From repo root — install deps
pnpm install

# 3. From apps/api — set up env
cp .env.example .env.local
# Generate dev JWT keypair into .env.local
node scripts/generate-dev-keys.mjs

# 4. Start the API
pnpm --filter=@mv/api dev
```

The API will listen on `http://localhost:3000`. Smoke-test:

```bash
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/version
```

## Quick auth walkthrough

```bash
# Request an OTP (dev mode returns the code in the response)
curl -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H 'content-type: application/json' \
  -d '{"phone":"+966555000001","purpose":"login"}'
# → { "sent": true, "devCode": "123456" }

# Verify it — first verification on an unknown phone bootstraps a customer
curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+966555000001","purpose":"login","code":"123456"}'
# → { "user": { "id": "..." }, "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }

# Call /me with the access token
curl http://localhost:3000/api/v1/auth/me -H 'authorization: Bearer <accessToken>'

# Rotate the refresh token (issues new access + new refresh; old refresh revoked)
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"<refresh>"}'
```

## Layout

```
src/
├── main.ts                 # process bootstrap
├── app.ts                  # express composition root
├── config/env.ts           # Zod-validated env
├── infra/                  # mongo, redis, socket.io, queue, logger
├── middleware/             # request-id, auth, rbac, ratelimit, idempotency, tenant, error
├── shared/                 # errors, utils, types
└── modules/                # domain modules
    ├── health/             # liveness, readiness, version, min-versions
    └── auth/               # users, JWT, refresh (with reuse detection), OTP
```

## Tests

```bash
pnpm --filter=@mv/api test
```

Unit tests run without infra. Integration tests (added per module as they land) spin Mongo/Redis via Testcontainers.

## Coding standards

- TypeScript strict + `noUncheckedIndexedAccess`.
- No `any`. Use Zod at the edges and `unknown` everywhere else.
- Money in halalas (integer). See `src/shared/utils/halalas.ts`.
- Errors thrown by services as `HttpError` subclasses → middleware translates to RFC 7807.
- JWT signed with RS256 keys from env; production loads from KMS.
- Refresh tokens stored hashed; rotation w/ reuse detection (revokes whole family).
