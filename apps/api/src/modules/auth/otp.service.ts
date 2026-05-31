import { createHash } from 'node:crypto';

import { Types } from 'mongoose';

import { env } from '../../config/env.js';
import { logger } from '../../infra/logger.js';
import { getRedis } from '../../infra/redis.js';
import { ConflictError, RateLimitedError, ValidationError } from '../../shared/errors/index.js';

import { OtpModel } from './models/otp.model.js';

type Purpose = 'login' | 'register' | 'verify' | 'reset';

function generateNumericCode(len: number): string {
  let out = '';
  while (out.length < len) {
    const buf = new Uint8Array(len);
    globalThis.crypto.getRandomValues(buf);
    for (const b of buf) {
      // discard 250..255 to avoid modulo bias for digits 0..9
      if (b < 250) out += (b % 10).toString();
      if (out.length === len) break;
    }
  }
  return out;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

async function checkRateLimits(phone: string): Promise<void> {
  const redis = getRedis();
  const minKey = `mv:otp:rl:${phone}:min:${Math.floor(Date.now() / 60_000)}`;
  const dayKey = `mv:otp:rl:${phone}:day:${new Date().toISOString().slice(0, 10)}`;

  const [minCount, dayCount] = await Promise.all([
    redis.incr(minKey).then(async (c) => {
      if (c === 1) await redis.expire(minKey, 70);
      return c;
    }),
    redis.incr(dayKey).then(async (c) => {
      if (c === 1) await redis.expire(dayKey, 60 * 60 * 26);
      return c;
    }),
  ]);

  if (minCount > env.OTP_RATE_PER_MIN) throw new RateLimitedError(60, 'Too many OTP requests this minute');
  if (dayCount > env.OTP_RATE_PER_DAY) throw new RateLimitedError(3600, 'Daily OTP limit reached');
}

export interface RequestOtpInput {
  tenantId: string;
  phone: string;
  purpose: Purpose;
}

export async function requestOtp(input: RequestOtpInput): Promise<{ sent: true; devCode?: string }> {
  await checkRateLimits(input.phone);

  const code = generateNumericCode(env.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await OtpModel.create({
    tenantId:   new Types.ObjectId(input.tenantId),
    phone:      input.phone,
    purpose:    input.purpose,
    hashedCode: hashCode(code),
    expiresAt,
  });

  if (env.OTP_DEV_MODE) {
    logger.debug({ phone: input.phone, purpose: input.purpose, code }, 'OTP issued (dev mode)');
    return { sent: true, devCode: code };
  }

  // TODO: enqueue SMS via NotificationService once that module is built (Phase 4).
  logger.info({ phone: input.phone, purpose: input.purpose }, 'OTP issued (SMS pending notifications module)');
  return { sent: true };
}

export interface VerifyOtpInput {
  tenantId: string;
  phone: string;
  purpose: Purpose;
  code: string;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<{ ok: true }> {
  const candidate = await OtpModel.findOne({
    tenantId:   new Types.ObjectId(input.tenantId),
    phone:      input.phone,
    purpose:    input.purpose,
    consumedAt: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!candidate) throw new ValidationError({ code: 'no active OTP for this phone' }, 'Invalid code');
  if (candidate.expiresAt.getTime() < Date.now()) {
    throw new ValidationError({ code: 'OTP expired' }, 'Invalid code');
  }
  if (candidate.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new ConflictError('otp-locked', 'Too many attempts; request a new code');
  }

  const matches = candidate.hashedCode === hashCode(input.code);
  if (!matches) {
    candidate.attempts += 1;
    await candidate.save();
    throw new ValidationError({ code: 'incorrect code' }, 'Invalid code');
  }

  candidate.consumedAt = new Date();
  await candidate.save();
  return { ok: true };
}
