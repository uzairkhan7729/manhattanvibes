/**
 * Customers module. The User model lives in auth/ (single source); this module
 * adds customer-only operations: addresses, marketing prefs, self-profile.
 *
 * RBAC:
 *   - GET /me — self only
 *   - GET /:id — self or admin
 *   - addresses — self only
 *   - admin list/search — admin/marketing
 */
import { Router, type Request, type Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { UserModel } from '../auth/models/user.model.js';

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

function ensureSelfOrAdmin(req: Request, id: string): void {
  if (!req.auth) throw new ForbiddenError();
  if (req.auth.userId !== id && req.auth.role !== 'SuperAdmin' && req.auth.role !== 'Marketing' && req.auth.role !== 'BranchManager') {
    throw new ForbiddenError('Cannot access another customer');
  }
}

export const customersRouter: Router = Router();

// ── Admin: list / search customers ───────────────────────────────────────
customersRouter.get('/', requireAuth, requirePermission('customers:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = z.object({
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);
    const find: Record<string, unknown> = { tenantId: tid(req.tenantId), type: 'customer' };
    if (q.search) {
      find.$or = [
        { email: { $regex: q.search, $options: 'i' } },
        { 'phone.number': { $regex: q.search.replace(/^\+/, '') } },
        { 'fullName.en': { $regex: q.search, $options: 'i' } },
        { 'fullName.ar': { $regex: q.search } },
      ];
    }
    const items = await UserModel.find(find, { passwordHash: 0, 'mfa.secret': 0 }).limit(q.limit).lean().exec();
    res.json({ items });
  }));

// ── Get single customer ──────────────────────────────────────────────────
customersRouter.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  ensureSelfOrAdmin(req, id);
  const doc = await UserModel.findOne({ _id: tid(id), tenantId: tid(req.tenantId), type: 'customer' }, { passwordHash: 0, 'mfa.secret': 0 }).lean().exec();
  if (!doc) throw new NotFoundError('Customer');
  res.json(doc);
}));

// ── Update self profile ──────────────────────────────────────────────────
const profilePatchSchema = z.object({
  fullName: z.object({ ar: z.string().optional(), en: z.string().min(1).optional() }).optional(),
  email: z.string().email().optional(),
  dob: z.string().datetime().optional(),
  gender: z.enum(['M', 'F', 'X']).optional(),
  preferredLanguage: z.enum(['ar', 'en']).optional(),
});
customersRouter.patch('/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  ensureSelfOrAdmin(req, id);
  const patch = profilePatchSchema.parse(req.body);
  const doc = await UserModel.findOneAndUpdate(
    { _id: tid(id), tenantId: tid(req.tenantId), type: 'customer' },
    { $set: patch },
    { new: true, projection: { passwordHash: 0, 'mfa.secret': 0 } },
  ).exec();
  if (!doc) throw new NotFoundError('Customer');
  res.json(doc);
}));

// ── Addresses ────────────────────────────────────────────────────────────
const addressSchema = z.object({
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  district: z.string().min(1),
  country: z.literal('SA').default('SA'),
  lat: z.number(),
  lng: z.number(),
  isDefault: z.boolean().default(false),
  instructions: z.string().optional(),
});

customersRouter.get('/:id/addresses', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  ensureSelfOrAdmin(req, id);
  const doc = await UserModel.findOne({ _id: tid(id), tenantId: tid(req.tenantId) }, { addresses: 1 }).lean().exec();
  res.json({ items: doc?.addresses ?? [] });
}));

customersRouter.post('/:id/addresses', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  ensureSelfOrAdmin(req, id);
  const addr = addressSchema.parse(req.body);

  if (addr.isDefault) {
    await UserModel.updateOne({ _id: tid(id) }, { $set: { 'addresses.$[].isDefault': false } });
  }
  const doc = await UserModel.findOneAndUpdate(
    { _id: tid(id), tenantId: tid(req.tenantId) },
    { $push: { addresses: addr } },
    { new: true, projection: { addresses: 1 } },
  ).exec();
  if (!doc) throw new NotFoundError('Customer');
  res.status(201).json({ items: doc.addresses });
}));

customersRouter.delete('/:id/addresses/:addrId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  const addrId = objectIdSchema.parse(req.params.addrId);
  ensureSelfOrAdmin(req, id);
  await UserModel.updateOne({ _id: tid(id) }, { $pull: { addresses: { _id: tid(addrId) } } });
  res.status(204).end();
}));

// ── Marketing prefs ──────────────────────────────────────────────────────
const prefsSchema = z.object({
  sms: z.boolean().optional(),
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  whatsapp: z.boolean().optional(),
});
customersRouter.post('/:id/marketing-prefs', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  ensureSelfOrAdmin(req, id);
  const prefs = prefsSchema.parse(req.body);
  const set: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(prefs)) if (typeof v === 'boolean') set[`marketingPrefs.${k}`] = v;
  const doc = await UserModel.findOneAndUpdate({ _id: tid(id), tenantId: tid(req.tenantId) }, { $set: set }, { new: true, projection: { marketingPrefs: 1 } }).exec();
  if (!doc) throw new NotFoundError('Customer');
  res.json(doc.marketingPrefs);
}));

// ── PDPL: anonymize ──────────────────────────────────────────────────────
customersRouter.post('/:id/anonymize', requireAuth, requirePermission('customers:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const doc = await UserModel.findOneAndUpdate(
      { _id: tid(id), tenantId: tid(req.tenantId), type: 'customer' },
      {
        $set: {
          email: undefined,
          fullName: { en: 'Anonymized', ar: undefined },
          addresses: [],
          status: 'deleted',
        },
      },
      { new: true },
    ).exec();
    if (!doc) throw new NotFoundError('Customer');
    res.json({ ok: true });
  }));
