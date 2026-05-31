import { createHash } from 'node:crypto';

import type { RequestHandler } from 'express';

import { getRedis } from '../infra/redis.js';
import { ConflictError } from '../shared/errors/index.js';

/**
 * RFC-style idempotency for state-mutating routes.
 *
 *   - clients send `Idempotency-Key: <uuid>`
 *   - we cache the (status, body) for 24h
 *   - replay with same key + same body  → return cached response
 *   - replay with same key + different body → 422 idempotency-key-conflict
 */
const TTL_SEC = 60 * 60 * 24;

interface CachedResponse {
  status: number;
  body: unknown;
  reqHash: string;
}

export const idempotencyMiddleware: RequestHandler = async (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();

  const key = req.header('idempotency-key');
  if (!key) return next();

  const redis = getRedis();
  const cacheKey = `mv:idemp:${req.tenantId}:${key}`;
  const reqHash = hashRequest(req);

  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as CachedResponse;
    if (parsed.reqHash !== reqHash) {
      return next(new ConflictError('idempotency-key-conflict', 'Idempotency-Key reused with different payload'));
    }
    res.setHeader('idempotent-replay', 'true');
    return res.status(parsed.status).json(parsed.body);
  }

  // Intercept the response so we can cache it.
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    const status = res.statusCode;
    // Only cache successful & client-error responses; skip 5xx.
    if (status < 500) {
      const payload: CachedResponse = { status, body, reqHash };
      void redis.set(cacheKey, JSON.stringify(payload), 'EX', TTL_SEC);
    }
    return originalJson(body);
  }) as typeof res.json;

  next();
};

function hashRequest(req: import('express').Request): string {
  const stable = JSON.stringify({ url: req.originalUrl, method: req.method, body: req.body ?? null });
  return createHash('sha256').update(stable).digest('hex');
}
