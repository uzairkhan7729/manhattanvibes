import { randomUUID } from 'node:crypto';

import { Types } from 'mongoose';

import { env } from '../../config/env.js';
import { logger } from '../../infra/logger.js';
import { generateRefreshToken, hashRefreshToken } from '../../shared/utils/jwt.js';

import { RefreshTokenModel } from './models/refresh-token.model.js';

export interface IssueRefreshInput {
  userId: string;
  tenantId: string;
  family?: string;            // omit to start a new family (fresh login)
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}

export async function issueRefreshToken(input: IssueRefreshInput): Promise<{ token: string; jti: string; family: string }> {
  const { token, hash } = generateRefreshToken();
  const jti = randomUUID();
  const family = input.family ?? randomUUID();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);

  await RefreshTokenModel.create({
    tenantId: new Types.ObjectId(input.tenantId),
    userId:   new Types.ObjectId(input.userId),
    jti,
    family,
    hashedToken: hash,
    deviceId:   input.deviceId,
    userAgent:  input.userAgent,
    ip:         input.ip,
    expiresAt,
  });

  return { token, jti, family };
}

export interface RotateRefreshResult {
  ok: true;
  userId: string;
  tenantId: string;
  family: string;
  newRefresh: { token: string; jti: string };
}

export interface RotateRefreshError {
  ok: false;
  reason: 'not-found' | 'expired' | 'revoked-reuse';
}

/**
 * Rotate a refresh token:
 *   - If the presented token's record is not-revoked & not-expired → rotate.
 *   - If it's already revoked → REUSE DETECTED: revoke the entire family.
 *   - If it doesn't exist → treat as not-found (don't leak presence info).
 */
export async function rotateRefreshToken(plaintext: string, ctx: { ip?: string; userAgent?: string; deviceId?: string }): Promise<RotateRefreshResult | RotateRefreshError> {
  const hash = hashRefreshToken(plaintext);
  const existing = await RefreshTokenModel.findOne({ hashedToken: hash });

  if (!existing) return { ok: false, reason: 'not-found' };

  if (existing.revokedAt) {
    // Reuse of a revoked token → kill the family.
    await RefreshTokenModel.updateMany(
      { family: existing.family, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'reuse-detected' } },
    );
    logger.warn({ userId: existing.userId.toString(), family: existing.family }, 'refresh token reuse — family revoked');
    return { ok: false, reason: 'revoked-reuse' };
  }

  if (existing.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  // Atomic: revoke old + issue new in same logical step.
  existing.revokedAt = new Date();
  existing.revokedReason = 'rotated';
  await existing.save();

  const issued = await issueRefreshToken({
    userId:   existing.userId.toString(),
    tenantId: existing.tenantId.toString(),
    family:   existing.family,
    deviceId: ctx.deviceId ?? existing.deviceId ?? undefined,
    userAgent: ctx.userAgent ?? existing.userAgent ?? undefined,
    ip:        ctx.ip ?? existing.ip ?? undefined,
  });

  return {
    ok: true,
    userId:   existing.userId.toString(),
    tenantId: existing.tenantId.toString(),
    family:   existing.family,
    newRefresh: { token: issued.token, jti: issued.jti },
  };
}

export async function revokeRefreshToken(plaintext: string, reason = 'logout'): Promise<boolean> {
  const hash = hashRefreshToken(plaintext);
  const res = await RefreshTokenModel.updateOne(
    { hashedToken: hash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return res.modifiedCount > 0;
}

export async function revokeAllForUser(userId: string, reason = 'logout-all'): Promise<number> {
  const res = await RefreshTokenModel.updateMany(
    { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return res.modifiedCount;
}
