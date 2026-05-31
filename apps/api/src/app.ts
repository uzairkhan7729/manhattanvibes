import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './infra/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { idempotencyMiddleware } from './middleware/idempotency.middleware.js';
import { anonRateLimit } from './middleware/ratelimit.middleware.js';
import { requestIdMiddleware } from './middleware/request-id.middleware.js';
import { tenantMiddleware } from './middleware/tenant.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { branchesRouter } from './modules/branches/branches.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { customersRouter } from './modules/customers/customers.module.js';
import { deliveryRouter } from './modules/delivery/delivery.module.js';
import { employeesRouter } from './modules/employees/employees.module.js';
import { healthRouter } from './modules/health/health.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.module.js';
import { kdsRouter } from './modules/kds/kds.module.js';
import { loyaltyRouter } from './modules/loyalty/loyalty.module.js';
import { notificationsRouter } from './modules/notifications/notifications.module.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { promotionsRouter } from './modules/promotions/promotions.module.js';
import { reportsRouter } from './modules/reports/reports.module.js';
import { syncRouter } from './modules/sync/sync.module.js';
import { tablesRouter } from './modules/tables/tables.module.js';

export function createApp(): Express {
  const app = express();
  if (!env.isDev) app.set('trust proxy', 1);

  // Cross-cutting middleware (order matters)
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { id?: string }).id ?? 'unknown',
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req(req) { return { method: req.method, url: req.url, id: req.id }; },
        res(res) { return { statusCode: res.statusCode }; },
      },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // CORS: in dev allow any localhost:* origin + Electron's app:// scheme so
  // POS/admin/KDS/web all "just work" regardless of which port Vite picks.
  // In prod fall back to the strict CORS_ORIGINS allowlist from env.
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);                                      // tools, same-origin
      if (env.isDev) {
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
        if (/^app:\/\//.test(origin)) return cb(null, true);                   // packaged Electron
      }
      if (env.corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS denied: ${origin}`));
    },
    credentials: true,
    exposedHeaders: ['x-request-id', 'retry-after'],
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(tenantMiddleware);

  // Public routes
  app.use('/health', healthRouter);

  // Versioned API
  const v1 = express.Router();
  v1.use(anonRateLimit());
  v1.use(idempotencyMiddleware);
  v1.use('/auth',          authRouter);
  v1.use('/customers',     customersRouter);
  v1.use('/branches',      branchesRouter);
  v1.use('/employees',     employeesRouter);
  v1.use('/tables',        tablesRouter);
  v1.use('/catalog',       catalogRouter);
  v1.use('/orders',        ordersRouter);
  v1.use('/payments',      paymentsRouter);
  v1.use('/loyalty',       loyaltyRouter);
  v1.use('/promotions',    promotionsRouter);
  v1.use('/inventory',     inventoryRouter);
  v1.use('/delivery',      deliveryRouter);
  v1.use('/kds',           kdsRouter);
  v1.use('/notifications', notificationsRouter);
  v1.use('/reports',       reportsRouter);
  v1.use('/sync',          syncRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
