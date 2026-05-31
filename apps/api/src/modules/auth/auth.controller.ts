import type { Request, Response } from 'express';

import { loginSchema, otpRequestSchema, otpVerifySchema, refreshSchema, registerSchema } from '@mv/validators';

import * as authService from './auth.service.js';
import * as otpService from './otp.service.js';
import { revokeAllForUser, revokeRefreshToken } from './refresh-token.service.js';

function ctxFromReq(req: Request): { ip?: string; userAgent?: string; deviceId?: string } {
  return {
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
    deviceId:  req.header('x-device-id') ?? undefined,
  };
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const result = await authService.register({ ...input, tenantId: req.tenantId }, ctxFromReq(req));
  res.status(201).json({
    user: { id: result.userId },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const result = await authService.loginWithPassword(input.identifier, input.password, ctxFromReq(req), req.tenantId);
  res.json({
    user: { id: result.userId },
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });
}

export async function otpRequestController(req: Request, res: Response): Promise<void> {
  const input = otpRequestSchema.parse(req.body);
  const result = await otpService.requestOtp({ ...input, tenantId: req.tenantId });
  // devCode included only when OTP_DEV_MODE=true
  res.json(result);
}

export async function otpVerifyController(req: Request, res: Response): Promise<void> {
  const input = otpVerifySchema.parse(req.body);
  await otpService.verifyOtp({ ...input, tenantId: req.tenantId });

  if (input.purpose === 'login' || input.purpose === 'register') {
    const tokens = await authService.loginWithOtp(input.phone, req.tenantId, ctxFromReq(req));
    res.json({
      user: { id: tokens.userId },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
    return;
  }
  // verify / reset: just confirm
  res.json({ ok: true });
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  const result = await authService.refresh(input.refreshToken, ctxFromReq(req));
  res.json(result);
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  await revokeRefreshToken(input.refreshToken, 'logout');
  res.json({ ok: true });
}

export async function logoutAllController(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ ok: false });
    return;
  }
  const n = await revokeAllForUser(req.auth.userId, 'logout-all');
  res.json({ ok: true, revoked: n });
}

export async function meController(req: Request, res: Response): Promise<void> {
  if (!req.auth) {
    res.status(401).json({ ok: false });
    return;
  }
  const me = await authService.getMe(req.auth.userId);
  res.json(me);
}
