import { Types } from 'mongoose';

import type { Role } from '@mv/shared-types';

import { ConflictError, NotFoundError, UnauthenticatedError } from '../../shared/errors/index.js';
import { signAccessToken } from '../../shared/utils/jwt.js';
import { hashPassword, verifyPassword } from '../../shared/utils/password.js';
import { parseE164 } from '../../shared/utils/phone.js';

import { UserModel, type UserDoc } from './models/user.model.js';
import { issueRefreshToken, rotateRefreshToken } from './refresh-token.service.js';

interface IssueTokensCtx {
  ip?: string;
  userAgent?: string;
  deviceId?: string;
}

async function issueTokens(user: UserDoc, ctx: IssueTokensCtx): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const access = await signAccessToken({
    userId:   user._id.toString(),
    role:     (user.role ?? 'Customer') as Role,
    tenantId: user.tenantId.toString(),
    branchIds: (user.branchIds ?? []).map((b) => b.toString()),
  });
  const refresh = await issueRefreshToken({
    userId:   user._id.toString(),
    tenantId: user.tenantId.toString(),
    deviceId:  ctx.deviceId,
    userAgent: ctx.userAgent,
    ip:        ctx.ip,
  });
  return { accessToken: access.token, refreshToken: refresh.token, expiresIn: access.expiresIn };
}

// ──────────────────────────────────────────────────────────────────────────
// Register
// ──────────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  tenantId: string;
  fullName: { ar?: string; en: string };
  phone: string;          // E.164
  email?: string;
  password?: string;
  preferredLanguage: 'ar' | 'en';
  marketingOptIn: boolean;
}

export async function register(input: RegisterInput, ctx: IssueTokensCtx): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }> {
  const parsed = parseE164(input.phone);

  // Conflicts checked upfront; the unique index is the final guard.
  const dupePhone = await UserModel.exists({ tenantId: new Types.ObjectId(input.tenantId), 'phone.number': parsed.number });
  if (dupePhone) throw new ConflictError('user-exists', 'Phone already registered');
  if (input.email) {
    const dupeEmail = await UserModel.exists({ tenantId: new Types.ObjectId(input.tenantId), email: input.email.toLowerCase() });
    if (dupeEmail) throw new ConflictError('user-exists', 'Email already registered');
  }

  const created = await UserModel.create({
    tenantId: new Types.ObjectId(input.tenantId),
    type:     'customer',
    role:     'Customer',
    phone:    parsed,
    email:    input.email?.toLowerCase(),
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    fullName: input.fullName,
    preferredLanguage: input.preferredLanguage,
    marketingPrefs: {
      sms: input.marketingOptIn, email: input.marketingOptIn, push: input.marketingOptIn, whatsapp: false,
    },
    status: 'active',
  });

  const tokens = await issueTokens(created, ctx);
  return { ...tokens, userId: created._id.toString() };
}

// ──────────────────────────────────────────────────────────────────────────
// Login (password)
// ──────────────────────────────────────────────────────────────────────────

export async function loginWithPassword(identifier: string, password: string, ctx: IssueTokensCtx, tenantId: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }> {
  const isEmail = identifier.includes('@');
  const query = isEmail
    ? { tenantId: new Types.ObjectId(tenantId), email: identifier.toLowerCase() }
    : { tenantId: new Types.ObjectId(tenantId), 'phone.number': parseE164(identifier).number };

  const user = await UserModel.findOne(query).select('+passwordHash').exec();
  if (!user || user.status !== 'active' || !user.passwordHash) {
    throw new UnauthenticatedError('Invalid credentials');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new UnauthenticatedError('Invalid credentials');

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user, ctx);
  return { ...tokens, userId: user._id.toString() };
}

// ──────────────────────────────────────────────────────────────────────────
// Login (OTP) — call after otp.verifyOtp() succeeds
// ──────────────────────────────────────────────────────────────────────────

export async function loginWithOtp(phone: string, tenantId: string, ctx: IssueTokensCtx): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; userId: string }> {
  const parsed = parseE164(phone);
  let user = await UserModel.findOne({ tenantId: new Types.ObjectId(tenantId), 'phone.number': parsed.number });

  if (!user) {
    // OTP-bootstrap registration: create a minimal customer record.
    user = await UserModel.create({
      tenantId: new Types.ObjectId(tenantId),
      type:     'customer',
      role:     'Customer',
      phone:    parsed,
      fullName: { en: 'Guest' },
      preferredLanguage: 'ar',
      phoneVerified: true,
      status: 'active',
    });
  } else {
    user.phoneVerified = true;
    user.lastLoginAt = new Date();
    await user.save();
  }

  const tokens = await issueTokens(user, ctx);
  return { ...tokens, userId: user._id.toString() };
}

// ──────────────────────────────────────────────────────────────────────────
// Refresh
// ──────────────────────────────────────────────────────────────────────────

export async function refresh(plaintext: string, ctx: IssueTokensCtx): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const result = await rotateRefreshToken(plaintext, ctx);
  if (!result.ok) {
    if (result.reason === 'revoked-reuse') {
      throw new UnauthenticatedError('Session revoked due to suspicious activity — please log in again');
    }
    throw new UnauthenticatedError('Invalid refresh token');
  }

  const user = await UserModel.findById(result.userId).exec();
  if (!user || user.status !== 'active') throw new UnauthenticatedError('User no longer active');

  const access = await signAccessToken({
    userId:   user._id.toString(),
    role:     (user.role ?? 'Customer') as Role,
    tenantId: user.tenantId.toString(),
    branchIds: (user.branchIds ?? []).map((b) => b.toString()),
    jti:      result.newRefresh.jti,
  });
  return { accessToken: access.token, refreshToken: result.newRefresh.token, expiresIn: access.expiresIn };
}

// ──────────────────────────────────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<{ id: string; fullName: { ar?: string; en: string }; phone: string; email?: string; role: Role; tenantId: string; branchIds: string[]; preferredLanguage: 'ar' | 'en'; emailVerified: boolean; phoneVerified: boolean }> {
  const user = await UserModel.findById(userId).exec();
  if (!user) throw new NotFoundError('User');
  return {
    id:        user._id.toString(),
    fullName:  {
      // Mongoose's InferSchemaType widens these to optional; flatten back.
      en: user.fullName?.en ?? '',
      ...(user.fullName?.ar ? { ar: user.fullName.ar } : {}),
    },
    phone:     `${user.phone.countryCode}${user.phone.number}`,
    email:     user.email ?? undefined,
    role:      (user.role ?? 'Customer') as Role,
    tenantId:  user.tenantId.toString(),
    branchIds: (user.branchIds ?? []).map((b) => b.toString()),
    preferredLanguage: (user.preferredLanguage ?? 'ar') as 'ar' | 'en',
    emailVerified: user.emailVerified ?? false,
    phoneVerified: user.phoneVerified ?? false,
  };
}
