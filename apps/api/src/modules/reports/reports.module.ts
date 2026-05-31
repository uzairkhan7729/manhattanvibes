/**
 * Reports — Phase 1 uses Mongo aggregations against orders/payments.
 * Phase 2 will introduce nightly rollups + a warehouse for heavy BI.
 *
 * Operational note: "today's sales" counts all placed orders that aren't
 * CANCELLED or REFUNDED, bucketed by createdAt in Asia/Riyadh local time.
 * A separate `paidGross` field shows captured-revenue only, so finance
 * and operations both see what they care about.
 */
import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { OrderModel } from '../orders/order.model.js';

export const reportsRouter: Router = Router();

const EXCLUDE_STATES = ['CANCELLED', 'REFUNDED'];

function dayBoundsKsa(date: string): { dayStart: Date; dayEnd: Date } {
  const dayStart = new Date(`${date}T00:00:00+03:00`);
  const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, dayEnd };
}

const dailySchema = z.object({ branchId: objectIdSchema, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

reportsRouter.get('/sales/daily', requireAuth, requirePermission('reports:branch'),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, date } = dailySchema.parse(req.query);
    const { dayStart, dayEnd } = dayBoundsKsa(date);

    const [agg] = await OrderModel.aggregate<{
      orders: number; gross: number; disc: number; vat: number; net: number; delivery: number;
      paidOrders: number; paidGross: number;
    }>([
      {
        $match: {
          tenantId: new Types.ObjectId(req.tenantId),
          branchId: new Types.ObjectId(branchId),
          state: { $nin: EXCLUDE_STATES },
          createdAt: { $gte: dayStart, $lt: dayEnd },
        },
      },
      {
        $group: {
          _id: null,
          orders:   { $sum: 1 },
          gross:    { $sum: '$pricing.subtotal' },
          disc:     { $sum: '$pricing.discountTotal' },
          vat:      { $sum: '$pricing.vat' },
          net:      { $sum: { $subtract: ['$pricing.total', '$pricing.vat'] } },
          delivery: { $sum: '$pricing.deliveryFee' },
          paidOrders: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          paidGross:  { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$pricing.total', 0] } },
        },
      },
    ]);

    res.json({
      branchId, date,
      summary: agg ?? { orders: 0, gross: 0, disc: 0, vat: 0, net: 0, delivery: 0, paidOrders: 0, paidGross: 0 },
    });
  }));

const rangeSchema = z.object({
  branchId: objectIdSchema.optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  groupBy: z.enum(['day', 'channel', 'branch']).default('day'),
});
reportsRouter.get('/sales/range', requireAuth, requirePermission('reports:branch'),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId, from, to, groupBy } = rangeSchema.parse(req.query);
    const match: Record<string, unknown> = {
      tenantId: new Types.ObjectId(req.tenantId),
      state: { $nin: EXCLUDE_STATES },
      createdAt: { $gte: new Date(from), $lte: new Date(to) },
    };
    if (branchId) match.branchId = new Types.ObjectId(branchId);

    const groupId: unknown =
      groupBy === 'day'     ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Riyadh' } } :
      groupBy === 'channel' ? '$channel' :
      groupBy === 'branch'  ? '$branchId' : '$_id';

    const rows = await OrderModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          orders: { $sum: 1 },
          gross:  { $sum: '$pricing.subtotal' },
          vat:    { $sum: '$pricing.vat' },
          total:  { $sum: '$pricing.total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({ groupBy, rows });
  }));

const vatSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });
reportsRouter.get('/vat', requireAuth, requirePermission('reports:branch'),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to } = vatSchema.parse(req.query);
    // VAT report keeps the paid-only filter: tax is only output once cash
    // changes hands. Unpaid/in-flight orders don't generate VAT obligation.
    const [agg] = await OrderModel.aggregate<{ vatOut: number; salesNet: number; salesGross: number }>([
      {
        $match: {
          tenantId: new Types.ObjectId(req.tenantId),
          paymentStatus: 'paid',
          createdAt: { $gte: new Date(from), $lte: new Date(to) },
        },
      },
      {
        $group: {
          _id: null,
          vatOut:    { $sum: '$pricing.vat' },
          salesNet:  { $sum: { $subtract: ['$pricing.total', '$pricing.vat'] } },
          salesGross:{ $sum: '$pricing.total' },
        },
      },
    ]);
    res.json({ from, to, summary: agg ?? { vatOut: 0, salesNet: 0, salesGross: 0 } });
  }));
