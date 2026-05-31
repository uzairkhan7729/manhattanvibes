import type { RequestHandler } from 'express';

import { UnauthenticatedError } from '../shared/errors/index.js';
import { verifyAccessToken } from '../shared/utils/jwt.js';

/**
 * Requires a valid Bearer access token; populates req.auth.
 * Use `optionalAuth` instead when a route works both authenticated and not.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) throw new UnauthenticatedError();
    const token = header.slice('Bearer '.length).trim();
    const claims = await verifyAccessToken(token);
    req.auth = {
      userId: claims.sub,
      role: claims.role,
      tenantId: claims.tenantId,
      branchIds: claims.branchIds,
      claims,
    };
    next();
  } catch (err: unknown) {
    if (err instanceof UnauthenticatedError) return next(err);
    next(new UnauthenticatedError('Invalid or expired token'));
  }
};

/** Same as requireAuth but silently no-ops when the header is absent. */
export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');
  if (!header) return next();
  return requireAuth(req, _res, next);
};
