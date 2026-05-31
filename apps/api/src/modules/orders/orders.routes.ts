import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import * as svc from './orders.service.js';
import type { OrderState } from './state-machine.js';

const itemSchema = z.object({
  productId: objectIdSchema,
  qty: z.number().int().min(1),
  sizeCode: z.enum(['S', 'M', 'L', 'XL']).optional(),
  crustCode: z.string().optional(),
  toppingIds: z.array(objectIdSchema).optional(),
  sauceIds: z.array(objectIdSchema).optional(),
  addonProductIds: z.array(z.object({ productId: objectIdSchema, qty: z.number().int().min(1) })).optional(),
  notes: z.string().optional(),
});

const placeSchema = z.object({
  branchId: objectIdSchema,
  channel: z.enum(['pos', 'web', 'mobile', 'phone']),
  type: z.enum(['dinein', 'takeaway', 'delivery', 'pickup']),
  items: z.array(itemSchema).min(1),
  customerId: objectIdSchema.optional(),
  tableId: objectIdSchema.optional(),
  guestInfo: z.object({ name: z.string().optional(), phone: z.string().optional() }).optional(),
  addressSnapshot: z.record(z.unknown()).optional(),
  promoCode: z.string().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  deliveryFee: z.number().int().min(0).optional(),
  tip: z.number().int().min(0).optional(),
  clientOpId: z.string().optional(),
});

const quoteSchema = placeSchema.omit({ customerId: true, tableId: true, guestInfo: true, addressSnapshot: true, clientOpId: true });

export const ordersRouter: Router = Router();

ordersRouter.post('/quote', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const input = quoteSchema.parse(req.body);
  res.json(await svc.quote(req.tenantId, input));
}));

ordersRouter.post('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const input = placeSchema.parse(req.body);
  const actor = { userId: req.auth?.userId, role: req.auth?.role, deviceId: req.header('x-device-id') ?? undefined };
  const order = await svc.placeOrder(req.tenantId, input, actor);
  res.status(201).json(order);
}));

ordersRouter.get('/', requireAuth, requirePermission('orders:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = z.object({
      branchId: objectIdSchema.optional(),
      state: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      customerId: objectIdSchema.optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }).parse(req.query);
    const items = await svc.listOrders(req.tenantId, {
      branchId: q.branchId,
      state: q.state as OrderState | undefined,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      customerId: q.customerId,
      limit: q.limit,
    });
    res.json({ items });
  }));

ordersRouter.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  res.json(await svc.getOrder(req.tenantId, id));
}));

ordersRouter.patch('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  const patch = z.object({ items: z.array(itemSchema).optional(), notes: z.string().optional() }).parse(req.body);
  res.json(await svc.modifyOrder(req.tenantId, id, patch));
}));

ordersRouter.post('/:id/transition', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  const { to, reason } = z.object({
    to: z.enum(['CONFIRMED', 'PREPARING', 'BAKING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'REFUNDED']),
    reason: z.string().optional(),
  }).parse(req.body);
  res.json(await svc.transition(req.tenantId, id, to as OrderState, { userId: req.auth?.userId }, reason));
}));

ordersRouter.post('/:id/cancel', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
  res.json(await svc.cancelOrder(req.tenantId, id, { userId: req.auth?.userId, role: req.auth?.role }, reason));
}));
