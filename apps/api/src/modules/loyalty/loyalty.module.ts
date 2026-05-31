/**
 * Loyalty — single-file module.
 *
 * Tier thresholds (rolling 12-month lifetime spend, halalas):
 *   bronze   0
 *   silver   150_000   (1,500 SAR)
 *   gold     400_000   (4,000 SAR)
 *   platinum 1_000_000 (10,000 SAR)
 *
 * Earn rate: 1 SAR (= 100 halalas) → 1 base point, multiplied by tier
 * (Bronze 1.0x, Silver 1.25x, Gold 1.5x, Platinum 2.0x).
 *
 * Redemption: 100 points = 100 halalas (= 1 SAR), capped at 50% of subtotal
 * (Platinum: 100%). Hold window: points credited with `accrualHoldUntil`
 * set to delivery + 24h.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import type { Halalas } from '../../shared/utils/halalas.js';

// ── Models ────────────────────────────────────────────────────────────────
const AccountSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, required: true, index: true, unique: true },
    tier:       { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
    pointsBalance:        { type: Number, default: 0 },
    lifetimeSpendHalalas: { type: Number, default: 0 },
    tierUpgradedAt:       { type: Date },
    tierExpiresAt:        { type: Date },
    status: { type: String, enum: ['active', 'frozen'], default: 'active' },
  },
  { timestamps: true },
);
type AccountDoc = InferSchemaType<typeof AccountSchema> & { _id: Types.ObjectId };
const AccountModel: Model<AccountDoc> = model<AccountDoc>('LoyaltyAccount', AccountSchema);

const LedgerSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    customerId:  { type: Schema.Types.ObjectId, required: true, index: true },
    accountId:   { type: Schema.Types.ObjectId, required: true, index: true },
    type:        { type: String, enum: ['earn', 'redeem', 'expire', 'adjust', 'birthday', 'referral'], required: true },
    points:      { type: Number, required: true },        // signed
    orderId:     { type: Schema.Types.ObjectId, ref: 'Order' },
    campaignId:  { type: Schema.Types.ObjectId },
    ref:         { type: String },
    ts:          { type: Date, default: Date.now, index: true },
    byUserId:    { type: Schema.Types.ObjectId, ref: 'User' },
    accrualHoldUntil: { type: Date },
  },
  { timestamps: false },
);
type LedgerDoc = InferSchemaType<typeof LedgerSchema> & { _id: Types.ObjectId };
const LedgerModel: Model<LedgerDoc> = model<LedgerDoc>('LoyaltyLedger', LedgerSchema);

// ── Helpers ───────────────────────────────────────────────────────────────
const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

const TIER_THRESHOLDS: Array<{ tier: 'bronze' | 'silver' | 'gold' | 'platinum'; min: Halalas; multiplier: number }> = [
  { tier: 'platinum', min: 1_000_000, multiplier: 2.0 },
  { tier: 'gold',     min:   400_000, multiplier: 1.5 },
  { tier: 'silver',   min:   150_000, multiplier: 1.25 },
  { tier: 'bronze',   min:         0, multiplier: 1.0 },
];

function tierFromSpend(spend: Halalas): { tier: 'bronze' | 'silver' | 'gold' | 'platinum'; multiplier: number } {
  for (const t of TIER_THRESHOLDS) if (spend >= t.min) return { tier: t.tier, multiplier: t.multiplier };
  return { tier: 'bronze', multiplier: 1.0 };
}

async function getOrCreateAccount(tenantId: string, customerId: string): Promise<HydratedDocument<AccountDoc>> {
  let doc = await AccountModel.findOne({ tenantId: tid(tenantId), customerId: tid(customerId) }).exec();
  if (!doc) {
    doc = await AccountModel.create({ tenantId: tid(tenantId), customerId: tid(customerId) });
  }
  return doc;
}

// ── Earn / Redeem / Adjust ────────────────────────────────────────────────
export interface EarnInput {
  tenantId: string;
  customerId: string;
  orderId: string;
  netSpendHalalas: Halalas;
  deliveredAt: Date;
}
export async function earn(input: EarnInput): Promise<LedgerDoc> {
  const account = await getOrCreateAccount(input.tenantId, input.customerId);
  const newSpend = account.lifetimeSpendHalalas + input.netSpendHalalas;
  const { tier, multiplier } = tierFromSpend(newSpend);
  const pointsEarned = Math.floor((input.netSpendHalalas / 100) * multiplier);

  const entry = await LedgerModel.create({
    tenantId: tid(input.tenantId), customerId: tid(input.customerId), accountId: account._id,
    type: 'earn', points: pointsEarned, orderId: tid(input.orderId),
    accrualHoldUntil: new Date(input.deliveredAt.getTime() + 24 * 60 * 60 * 1000),
  });

  account.pointsBalance += pointsEarned;
  account.lifetimeSpendHalalas = newSpend;
  if (account.tier !== tier) {
    account.tier = tier;
    account.tierUpgradedAt = new Date();
  }
  await account.save();
  return entry;
}

export async function redeem(tenantId: string, customerId: string, points: number, orderId?: string): Promise<LedgerDoc> {
  const account = await getOrCreateAccount(tenantId, customerId);
  if (account.pointsBalance < points) throw new ConflictError('insufficient-points', 'Not enough points');

  const entry = await LedgerModel.create({
    tenantId: tid(tenantId), customerId: tid(customerId), accountId: account._id,
    type: 'redeem', points: -points, orderId: orderId ? tid(orderId) : undefined,
  });
  account.pointsBalance -= points;
  await account.save();
  return entry;
}

export async function adjust(tenantId: string, customerId: string, points: number, reason: string, byUserId?: string): Promise<LedgerDoc> {
  const account = await getOrCreateAccount(tenantId, customerId);
  const entry = await LedgerModel.create({
    tenantId: tid(tenantId), customerId: tid(customerId), accountId: account._id,
    type: 'adjust', points, ref: reason, byUserId: byUserId ? tid(byUserId) : undefined,
  });
  account.pointsBalance += points;
  await account.save();
  return entry;
}

// ── Reads ─────────────────────────────────────────────────────────────────
export async function getAccount(tenantId: string, customerId: string): Promise<HydratedDocument<AccountDoc>> {
  return getOrCreateAccount(tenantId, customerId);
}

export async function getLedger(accountId: string, limit = 100): Promise<LedgerDoc[]> {
  return LedgerModel.find({ accountId: tid(accountId) }).sort({ ts: -1 }).limit(limit).lean<LedgerDoc[]>().exec();
}

// ── Routes ────────────────────────────────────────────────────────────────
export const loyaltyRouter: Router = Router();

loyaltyRouter.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new NotFoundError('Account');
  const acc = await getAccount(req.tenantId, req.auth.userId);
  res.json(acc);
}));

loyaltyRouter.get('/:customerId', requireAuth, requirePermission('customers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.customerId);
    res.json(await getAccount(req.tenantId, id));
  }));

loyaltyRouter.get('/:customerId/ledger', requireAuth, requirePermission('customers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.customerId);
    const acc = await getAccount(req.tenantId, id);
    res.json({ items: await getLedger(acc._id.toString()) });
  }));

const adjustSchema = z.object({ points: z.number().int(), reason: z.string().min(1) });
loyaltyRouter.post('/:customerId/adjust', requireAuth, requirePermission('customers:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.customerId);
    const { points, reason } = adjustSchema.parse(req.body);
    res.json(await adjust(req.tenantId, id, points, reason, req.auth?.userId));
  }));

loyaltyRouter.get('/tiers', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ tiers: TIER_THRESHOLDS });
}));
