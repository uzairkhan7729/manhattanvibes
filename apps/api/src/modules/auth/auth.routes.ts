import { Router } from 'express';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { makeRateLimiter } from '../../middleware/ratelimit.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import {
  loginController,
  logoutAllController,
  logoutController,
  meController,
  otpRequestController,
  otpVerifyController,
  refreshController,
  registerController,
} from './auth.controller.js';

export const authRouter: Router = Router();

// Tight per-IP limit on auth surfaces to thwart credential stuffing & card-testing.
const authIpLimit = makeRateLimiter({
  prefix: 'auth-ip',
  points: 20,
  durationSec: 60,
  key: (req) => req.ip ?? 'unknown',
});

authRouter.post('/register',     authIpLimit, asyncHandler(registerController));
authRouter.post('/login',        authIpLimit, asyncHandler(loginController));
authRouter.post('/otp/request',  authIpLimit, asyncHandler(otpRequestController));
authRouter.post('/otp/verify',   authIpLimit, asyncHandler(otpVerifyController));
authRouter.post('/refresh',      authIpLimit, asyncHandler(refreshController));
authRouter.post('/logout',       asyncHandler(logoutController));
authRouter.post('/logout-all',   requireAuth, asyncHandler(logoutAllController));
authRouter.get( '/me',           requireAuth, asyncHandler(meController));
