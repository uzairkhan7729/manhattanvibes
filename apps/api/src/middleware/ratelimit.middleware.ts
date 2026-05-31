import type { RequestHandler } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';

import { env } from '../config/env.js';
import { getRedis } from '../infra/redis.js';
import { RateLimitedError } from '../shared/errors/index.js';

interface MakeLimiterOpts {
  /** Unique key prefix in Redis. */
  prefix: string;
  /** Max points per window. */
  points: number;
  /** Window duration in seconds. */
  durationSec: number;
  /** Function to derive the rate-limit key from the request. */
  key?: (req: import('express').Request) => string;
  /** Block duration in seconds when exceeded. */
  blockSec?: number;
}

export function makeRateLimiter(opts: MakeLimiterOpts): RequestHandler {
  const limiter = new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: `mv:rl:${opts.prefix}`,
    points: opts.points,
    duration: opts.durationSec,
    blockDuration: opts.blockSec,
  });

  return async (req, _res, next) => {
    const key = opts.key?.(req) ?? defaultKey(req);
    try {
      await limiter.consume(key, 1);
      next();
    } catch (e: unknown) {
      // rate-limiter-flexible throws RateLimiterRes on exceeded
      const retry = isLimiterRes(e) ? Math.ceil(e.msBeforeNext / 1000) : 60;
      next(new RateLimitedError(retry));
    }
  };
}

function defaultKey(req: import('express').Request): string {
  // user id when authenticated, else IP
  return req.auth?.userId ?? req.ip ?? 'unknown';
}

function isLimiterRes(e: unknown): e is { msBeforeNext: number } {
  return typeof e === 'object' && e !== null && 'msBeforeNext' in e;
}

/** Generic anonymous-IP limiter for public routes. */
export const anonRateLimit = (): RequestHandler =>
  makeRateLimiter({
    prefix: 'anon',
    points: env.RATE_LIMIT_ANON_PER_MIN,
    durationSec: 60,
    key: (req) => req.ip ?? 'unknown',
  });
