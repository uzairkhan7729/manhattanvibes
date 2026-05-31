import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Layered env loading: .env, then .env.local (overrides). Both relative to the
// working directory (which is apps/api when run via the workspace script).
for (const name of ['.env', '.env.local']) {
  const path = resolve(process.cwd(), name);
  if (existsSync(path)) loadDotenv({ path, override: true });
}

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SERVICE_NAME: z.string().default('mv-api'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  DEFAULT_TENANT_ID: z.string().regex(/^[a-f0-9]{24}$/i, 'must be a 24-hex tenant id'),

  // Mongo
  MONGO_URI: z.string().min(1),
  MONGO_MAX_POOL: z.coerce.number().int().min(1).default(50),

  // Redis
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  // JWT (PEM strings; in prod loaded from secret manager and injected at boot)
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  JWT_ISSUER: z.string().default('manhattan-vibes'),
  JWT_AUDIENCE: z.string().default('mv-clients'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(3600).default(60 * 60 * 24 * 7),
  JWT_KID: z.string().default('dev-1'),

  // OTP
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().min(60).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(5),
  OTP_RATE_PER_MIN: z.coerce.number().int().min(1).default(3),
  OTP_RATE_PER_DAY: z.coerce.number().int().min(1).default(20),
  OTP_DEV_MODE: z
    .union([z.string(), z.boolean()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),

  // Rate limiting
  RATE_LIMIT_ANON_PER_MIN: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_CUSTOMER_PER_MIN: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_STAFF_PER_MIN: z.coerce.number().int().min(1).default(1000),

  // CORS — comma separated
  CORS_ORIGINS: z.string().default(''),

  // Bcrypt
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
});

// `process.env` access here is the one allowed location.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print clearly and exit — no point bringing up an app with bad config.
  const errors = parsed.error.flatten().fieldErrors;
  // eslint-disable-next-line no-console
  console.error('[config] invalid environment:');
  for (const [key, msgs] of Object.entries(errors)) {
    // eslint-disable-next-line no-console
    console.error(`  - ${key}: ${msgs?.join(', ')}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  // Convenience
  isProd: raw.NODE_ENV === 'production',
  isDev: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  // Unescape literal `\n` sequences allowed in env-var PEM blocks.
  jwtPrivateKey: raw.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'),
  jwtPublicKey: raw.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'),
} as const;

export type Env = typeof env;
