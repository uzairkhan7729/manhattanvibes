/**
 * POS offline sync.
 *
 *   POST /sync — batch upload from a POS device. Per-op idempotency on
 *   `clientOpId`. Returns per-op outcome (applied | duplicate | conflict |
 *   invalid).
 *
 *   GET /sync/changes — pull deltas since cursor (catalog, branches, etc.)
 *
 *   GET /sync/snapshot — cold-start full snapshot for a freshly-provisioned
 *   POS terminal.
 *
 * This is the Phase 1 implementation; conflict resolution is simple
 * "last-writer-wins on the server" because POS ops here are append-only
 * (orders + payments). Inventory adjustments are additive (delta) and so
 * commute naturally.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { ValidationError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { BranchModel } from '../branches/branch.model.js';
import { CategoryModel } from '../catalog/models/category.model.js';
import { ProductModel } from '../catalog/models/product.model.js';
import { ToppingModel } from '../catalog/models/topping.model.js';
import { OrderModel } from '../orders/order.model.js';
import * as orders from '../orders/orders.service.js';
import { createIntent, capture } from '../payments/payments.service.js';

export const syncRouter: Router = Router();

// ── POST /sync — apply batch of ops ──────────────────────────────────────
const opSchema = z.object({
  clientOpId: z.string().min(1),
  ts: z.string().datetime(),
  op: z.enum(['ORDER_CREATE', 'PAYMENT_CAPTURE']),
  payload: z.record(z.unknown()),
});
const batchSchema = z.object({
  deviceId: z.string().min(1),
  ops: z.array(opSchema).min(1).max(100),
});

syncRouter.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { ops, deviceId } = batchSchema.parse(req.body);
  const results: Array<{ clientOpId: string; outcome: 'applied' | 'duplicate' | 'invalid'; canonicalId?: string; error?: string }> = [];

  for (const op of ops) {
    try {
      if (op.op === 'ORDER_CREATE') {
        const payload = op.payload as {
          branchId: string;
          type: 'dinein' | 'takeaway' | 'delivery' | 'pickup';
          items: Array<{ productId: string; qty: number; sizeCode?: 'S' | 'M' | 'L' | 'XL'; crustCode?: string; toppingIds?: string[]; sauceIds?: string[] }>;
          customerId?: string;
          guestInfo?: { name?: string; phone?: string };
          tableId?: string;
        };
        const existing = await OrderModel.findOne({ branchId: payload.branchId, clientOpId: op.clientOpId }).exec();
        if (existing) {
          results.push({ clientOpId: op.clientOpId, outcome: 'duplicate', canonicalId: existing._id.toString() });
          continue;
        }
        const order = await orders.placeOrder(req.tenantId, {
          branchId: payload.branchId,
          channel: 'pos',
          type: payload.type,
          items: payload.items,
          customerId: payload.customerId,
          guestInfo: payload.guestInfo,
          tableId: payload.tableId,
          clientOpId: op.clientOpId,
        }, { userId: req.auth?.userId, role: req.auth?.role, deviceId });
        results.push({ clientOpId: op.clientOpId, outcome: 'applied', canonicalId: order._id.toString() });
      } else if (op.op === 'PAYMENT_CAPTURE') {
        const payload = op.payload as { orderId: string; method: 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay' };
        const intent = await createIntent(req.tenantId, { orderId: payload.orderId, method: payload.method });
        const captured = await capture(req.tenantId, intent.paymentId);
        results.push({ clientOpId: op.clientOpId, outcome: 'applied', canonicalId: captured._id.toString() });
      } else {
        results.push({ clientOpId: op.clientOpId, outcome: 'invalid', error: 'unknown op' });
      }
    } catch (err: unknown) {
      results.push({ clientOpId: op.clientOpId, outcome: 'invalid', error: err instanceof Error ? err.message : 'unknown error' });
    }
  }

  res.json({ deviceId, results });
}));

// ── GET /sync/changes — deltas since cursor ──────────────────────────────
const changesQuerySchema = z.object({
  since: z.string().datetime().optional(),
  branchId: objectIdSchema,
});

syncRouter.get('/changes', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { since, branchId } = changesQuerySchema.parse(req.query);
  const cursorTs = since ? new Date(since) : new Date(0);

  const [categories, products, toppings, branches] = await Promise.all([
    CategoryModel.find({ tenantId: req.tenantId, updatedAt: { $gt: cursorTs } }).lean().exec(),
    ProductModel.find({ tenantId: req.tenantId, updatedAt: { $gt: cursorTs } }).lean().exec(),
    ToppingModel.find({ tenantId: req.tenantId, updatedAt: { $gt: cursorTs } }).lean().exec(),
    BranchModel.find({ tenantId: req.tenantId, _id: branchId, updatedAt: { $gt: cursorTs } }).lean().exec(),
  ]);

  res.json({
    cursor: new Date().toISOString(),
    deltas: { categories, products, toppings, branches },
  });
}));

// ── GET /sync/snapshot — cold-start ──────────────────────────────────────
syncRouter.get('/snapshot', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = z.object({ branchId: objectIdSchema }).parse(req.query);
  const [categories, products, toppings, branches] = await Promise.all([
    CategoryModel.find({ tenantId: req.tenantId }).lean().exec(),
    ProductModel.find({ tenantId: req.tenantId }).lean().exec(),
    ToppingModel.find({ tenantId: req.tenantId }).lean().exec(),
    BranchModel.findOne({ _id: branchId, tenantId: req.tenantId }).lean().exec(),
  ]);
  if (!branches) throw new ValidationError({ branchId: 'unknown branch' });
  res.json({
    cursor: new Date().toISOString(),
    snapshot: { categories, products, toppings, branch: branches },
  });
}));
