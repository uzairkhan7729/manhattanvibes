/**
 * KDS — Kitchen Display System. Read queue snapshot + bump endpoints.
 * Real-time fan-out happens in orders/orders.service.ts via Socket.IO.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { getOrder, listOrders, transition } from '../orders/orders.service.js';
import type { OrderState } from '../orders/state-machine.js';

export const kdsRouter: Router = Router();

const queueQuerySchema = z.object({
  branchId: objectIdSchema,
  station: z.string().optional(),       // future use — station-routed items
});

kdsRouter.get('/queue', requireAuth, requirePermission('orders:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId } = queueQuerySchema.parse(req.query);
    const buckets: Record<string, unknown[]> = { incoming: [], preparing: [], baking: [], ready: [] };

    const incoming  = await listOrders(req.tenantId, { branchId, state: 'CONFIRMED', limit: 100 });
    const preparing = await listOrders(req.tenantId, { branchId, state: 'PREPARING', limit: 100 });
    const baking    = await listOrders(req.tenantId, { branchId, state: 'BAKING', limit: 100 });
    const ready     = await listOrders(req.tenantId, { branchId, state: 'READY', limit: 100 });

    buckets.incoming = incoming;
    buckets.preparing = preparing;
    buckets.baking = baking;
    buckets.ready = ready;

    res.json({ branchId, generatedAt: new Date().toISOString(), buckets });
  }));

// Bump = advance one step in the kitchen pipeline.
// Allowed: CONFIRMED → PREPARING → BAKING → READY.
const NEXT: Partial<Record<OrderState, OrderState>> = {
  CONFIRMED: 'PREPARING',
  PREPARING: 'BAKING',
  BAKING:    'READY',
  READY:     'CLOSED',
};
kdsRouter.post('/bump/:orderId', requireAuth, requirePermission('orders:state:advance'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = objectIdSchema.parse(req.params.orderId);
    const order = await getOrder(req.tenantId, orderId);
    const next = NEXT[order.state as OrderState];
    if (!next) throw new Error('no-next-state-from-current');
    res.json(await transition(req.tenantId, orderId, next, { userId: req.auth?.userId }));
  }));
