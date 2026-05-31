/**
 * Promotions — coupons + campaigns.
 *
 * Coupon kinds:
 *   percent    — N% off subtotal (with maxDiscount cap)
 *   flat       — flat halalas off
 *   freeDelivery — sets deliveryFee discount equal to incoming fee
 *   freeItem   — free product (productId in `reward`) — handled in cart engine
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import type { Halalas } from '../../shared/utils/halalas.js';

// ── Coupon model ──────────────────────────────────────────────────────────
const CouponSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    code:        { type: String, required: true, uppercase: true, trim: true },
    kind:        { type: String, enum: ['percent', 'flat', 'freeDelivery', 'freeItem'], required: true },
    value:       { type: Number, default: 0 },           // % or halalas
    minOrder:    { type: Number, default: 0 },
    maxDiscount: { type: Number },
    productScope:  [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    categoryScope: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    channels:    [{ type: String, enum: ['pos', 'web', 'mobile', 'phone'] }],
    branchIds:   [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    validFrom:   { type: Date, required: true },
    validTo:     { type: Date, required: true },
    daysOfWeek:  [{ type: Number, min: 0, max: 6 }],
    hoursOfDay:  { start: Number, end: Number },         // hour 0..23
    usageLimit:  { type: Number },
    perCustomerLimit: { type: Number },
    usedCount:   { type: Number, default: 0 },
    firstOrderOnly: { type: Boolean, default: false },
    stackableWithLoyalty: { type: Boolean, default: true },
    isActive:    { type: Boolean, default: true },
    reward:      { type: Schema.Types.Mixed },           // for freeItem etc.
  },
  { timestamps: true },
);
CouponSchema.index({ tenantId: 1, code: 1 }, { unique: true });

type CouponDoc = InferSchemaType<typeof CouponSchema> & { _id: Types.ObjectId };
const CouponModel: Model<CouponDoc> = model<CouponDoc>('Coupon', CouponSchema);

// ── Campaign model (skeleton) ─────────────────────────────────────────────
const CampaignSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, required: true, index: true },
    name:       { type: String, required: true },
    segmentId:  { type: Schema.Types.ObjectId },
    channel:    { type: String, enum: ['push', 'sms', 'email', 'whatsapp'], required: true },
    templateKey:{ type: String, required: true },
    status:     { type: String, enum: ['draft', 'approved', 'sent', 'failed'], default: 'draft' },
    scheduledAt:{ type: Date },
    launchedAt: { type: Date },
    stats: {
      attempted: { type: Number, default: 0 },
      sent:      { type: Number, default: 0 },
      failed:    { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);
type CampaignDoc = InferSchemaType<typeof CampaignSchema> & { _id: Types.ObjectId };
const CampaignModel: Model<CampaignDoc> = model<CampaignDoc>('Campaign', CampaignSchema);

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ── Validate coupon against a cart ────────────────────────────────────────
export interface CouponValidateInput {
  tenantId: string;
  code: string;
  subtotal: Halalas;
  channel: 'pos' | 'web' | 'mobile' | 'phone';
  branchId?: string;
  customerId?: string;
}

export interface CouponValidateResult {
  ok: boolean;
  reason?: string;
  discount?: Halalas;
  freeDelivery?: boolean;
  couponId?: string;
}

export async function validateCoupon(input: CouponValidateInput): Promise<CouponValidateResult> {
  const c = await CouponModel.findOne({ tenantId: tid(input.tenantId), code: input.code.toUpperCase(), isActive: true }).exec();
  if (!c) return { ok: false, reason: 'unknown-code' };
  const now = new Date();
  if (now < c.validFrom || now > c.validTo) return { ok: false, reason: 'expired-or-not-started' };
  if (c.channels && c.channels.length > 0 && !c.channels.includes(input.channel)) return { ok: false, reason: 'channel-not-allowed' };
  if (c.branchIds && c.branchIds.length > 0 && input.branchId && !c.branchIds.some((b) => b.equals(tid(input.branchId!)))) {
    return { ok: false, reason: 'branch-not-allowed' };
  }
  if (c.minOrder && input.subtotal < c.minOrder) return { ok: false, reason: 'min-order-not-met' };
  if (c.usageLimit && (c.usedCount ?? 0) >= c.usageLimit) return { ok: false, reason: 'usage-limit-reached' };
  if (c.daysOfWeek && c.daysOfWeek.length > 0 && !c.daysOfWeek.includes(now.getDay())) return { ok: false, reason: 'day-not-allowed' };
  if (c.hoursOfDay && (c.hoursOfDay.start ?? 0) > 0) {
    const h = now.getHours();
    if (h < (c.hoursOfDay.start ?? 0) || h >= (c.hoursOfDay.end ?? 24)) return { ok: false, reason: 'hour-not-allowed' };
  }

  if (c.kind === 'percent') {
    let amount = Math.floor(input.subtotal * c.value / 100);
    if (c.maxDiscount) amount = Math.min(amount, c.maxDiscount);
    return { ok: true, discount: amount, couponId: c._id.toString() };
  }
  if (c.kind === 'flat') {
    return { ok: true, discount: Math.min(c.value, input.subtotal), couponId: c._id.toString() };
  }
  if (c.kind === 'freeDelivery') {
    return { ok: true, freeDelivery: true, couponId: c._id.toString() };
  }
  return { ok: true, couponId: c._id.toString() };
}

// ── CRUD helpers ──────────────────────────────────────────────────────────
async function createCoupon(tenantId: string, input: Partial<CouponDoc> & { code: string; kind: 'percent' | 'flat' | 'freeDelivery' | 'freeItem' }): Promise<CouponDoc> {
  const dupe = await CouponModel.exists({ tenantId: tid(tenantId), code: input.code.toUpperCase() });
  if (dupe) throw new ConflictError('coupon-exists', `Code "${input.code}" already used`);
  return CouponModel.create({ ...input, code: input.code.toUpperCase(), tenantId: tid(tenantId) });
}

// ── Routes ────────────────────────────────────────────────────────────────
export const promotionsRouter: Router = Router();

promotionsRouter.get('/coupons', requireAuth, requirePermission('promotions:read'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ items: await CouponModel.find({ tenantId: tid(req.tenantId) }).lean().exec() });
  }));

const createCouponSchema = z.object({
  code: z.string().min(1),
  kind: z.enum(['percent', 'flat', 'freeDelivery', 'freeItem']),
  value: z.number().min(0).default(0),
  minOrder: z.number().int().min(0).optional(),
  maxDiscount: z.number().int().min(0).optional(),
  channels: z.array(z.enum(['pos', 'web', 'mobile', 'phone'])).optional(),
  branchIds: z.array(objectIdSchema).optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  usageLimit: z.number().int().min(1).optional(),
  firstOrderOnly: z.boolean().optional(),
  stackableWithLoyalty: z.boolean().optional(),
});
promotionsRouter.post('/coupons', requireAuth, requirePermission('promotions:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = createCouponSchema.parse(req.body);
    res.status(201).json(await createCoupon(req.tenantId, { ...input, validFrom: new Date(input.validFrom), validTo: new Date(input.validTo) } as never));
  }));

const validateSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().min(0),
  channel: z.enum(['pos', 'web', 'mobile', 'phone']),
  branchId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
});
promotionsRouter.post('/coupons/validate', asyncHandler(async (req: Request, res: Response) => {
  const input = validateSchema.parse(req.body);
  res.json(await validateCoupon({ ...input, tenantId: req.tenantId }));
}));

// Campaigns
promotionsRouter.get('/campaigns', requireAuth, requirePermission('campaigns:read'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ items: await CampaignModel.find({ tenantId: tid(req.tenantId) }).lean().exec() });
  }));

const createCampaignSchema = z.object({
  name: z.string().min(1),
  segmentId: objectIdSchema.optional(),
  channel: z.enum(['push', 'sms', 'email', 'whatsapp']),
  templateKey: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
});
promotionsRouter.post('/campaigns', requireAuth, requirePermission('campaigns:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = createCampaignSchema.parse(req.body);
    res.status(201).json(await CampaignModel.create({ ...input, tenantId: tid(req.tenantId), scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined }));
  }));

promotionsRouter.post('/campaigns/:id/launch', requireAuth, requirePermission('campaigns:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const c = await CampaignModel.findOne({ _id: tid(id), tenantId: tid(req.tenantId) }).exec();
    if (!c) throw new NotFoundError('Campaign');
    c.status = 'sent';                                     // notifications worker will fan out in real impl
    c.launchedAt = new Date();
    await c.save();
    res.json(c);
  }));
