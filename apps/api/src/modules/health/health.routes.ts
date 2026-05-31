import { Router } from 'express';

import { mongoHealth } from '../../infra/mongo.js';
import { redisHealth } from '../../infra/redis.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

const VERSION = process.env.npm_package_version ?? '0.1.0';
const BUILD_TIME = process.env.BUILD_TIME ?? new Date().toISOString();

export const healthRouter: Router = Router();

healthRouter.get('/live', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const mongo = mongoHealth();
    const redis = await redisHealth();
    const ok = mongo.ok && redis.ok;
    res.status(ok ? 200 : 503).json({
      ok,
      checks: { mongo, redis },
      ts: new Date().toISOString(),
    });
  }),
);

healthRouter.get('/version', (_req, res) => {
  res.json({ name: 'mv-api', version: VERSION, buildTime: BUILD_TIME, node: process.version });
});

healthRouter.get('/min-versions', (_req, res) => {
  // Minimum client versions allowed to connect. Older clients get 426 from a future middleware.
  res.json({
    pos: { minBuild: 1 },
    mobile: { ios: { minBuild: 1 }, android: { minBuild: 1 } },
    web: { minBuild: 1 },
  });
});
