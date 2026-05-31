import type { RequestHandler } from 'express';

import { env } from '../config/env.js';

/**
 * Phase 1: single tenant — resolve from JWT if available, otherwise default.
 * Phase 2+ will resolve from Host header or subdomain.
 */
export const tenantMiddleware: RequestHandler = (req, _res, next) => {
  req.tenantId = req.auth?.tenantId ?? env.DEFAULT_TENANT_ID;
  next();
};
