/**
 * Single-file employees module. Staff = users with role !== 'Customer'.
 * Operations are thin wrappers over the User model; shift clock-in/out
 * is a separate collection.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema, phoneSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { hashPassword } from '../../shared/utils/password.js';
import { parseE164 } from '../../shared/utils/phone.js';
import { UserModel } from '../auth/models/user.model.js';

// ── Shift model ───────────────────────────────────────────────────────────
const ShiftSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    branchId:    { type: Schema.Types.ObjectId, required: true, index: true },
    userId:      { type: Schema.Types.ObjectId, required: true, index: true },
    clockInAt:   { type: Date, required: true },
    clockOutAt:  { type: Date },
    openingFloat:{ type: Number, default: 0 },     // cash drawer float
    closingCount:{ type: Number },                  // cash counted
  },
  { timestamps: true },
);
ShiftSchema.index({ branchId: 1, userId: 1, clockInAt: -1 });

type ShiftDoc = InferSchemaType<typeof ShiftSchema> & { _id: Types.ObjectId };
const ShiftModel: Model<ShiftDoc> = model<ShiftDoc>('Shift', ShiftSchema);

// ── Service ───────────────────────────────────────────────────────────────
const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

const createEmployeeSchema = z.object({
  fullName: z.object({ ar: z.string().optional(), en: z.string().min(1) }),
  phone:    phoneSchema,
  email:    z.string().email().optional(),
  password: z.string().min(10),
  role:     z.enum(['SuperAdmin', 'BranchManager', 'Cashier', 'KitchenStaff', 'Driver', 'Marketing']),
  branchIds: z.array(objectIdSchema).default([]),
  employmentId: z.string().optional(),
});

async function createEmployee(tenantId: string, input: z.infer<typeof createEmployeeSchema>): Promise<unknown> {
  const phone = parseE164(input.phone);
  const dupe = await UserModel.exists({ tenantId: tid(tenantId), 'phone.number': phone.number });
  if (dupe) throw new ConflictError('user-exists', 'Phone already registered');
  const created = await UserModel.create({
    tenantId: tid(tenantId),
    type: 'staff',
    role: input.role,
    fullName: input.fullName,
    phone,
    email: input.email?.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    branchIds: input.branchIds.map(tid),
    employmentId: input.employmentId,
    preferredLanguage: 'ar',
    status: 'active',
  });
  return { id: created._id.toString(), fullName: created.fullName, role: created.role, branchIds: input.branchIds };
}

async function listEmployees(tenantId: string, opts?: { branchId?: string; role?: string }): Promise<unknown[]> {
  const q: Record<string, unknown> = { tenantId: tid(tenantId), type: 'staff', status: 'active' };
  if (opts?.branchId) q.branchIds = tid(opts.branchId);
  if (opts?.role) q.role = opts.role;
  return UserModel.find(q, { passwordHash: 0 }).lean().exec();
}

async function clockIn(tenantId: string, userId: string, branchId: string, openingFloat: number): Promise<ShiftDoc> {
  const existing = await ShiftModel.findOne({ userId: tid(userId), clockOutAt: { $exists: false } }).exec();
  if (existing) throw new ConflictError('shift-already-open', 'Shift already open');
  return ShiftModel.create({
    tenantId: tid(tenantId), branchId: tid(branchId), userId: tid(userId),
    clockInAt: new Date(), openingFloat,
  });
}

async function clockOut(userId: string, closingCount: number): Promise<ShiftDoc> {
  const shift = await ShiftModel.findOne({ userId: tid(userId), clockOutAt: { $exists: false } }).exec();
  if (!shift) throw new NotFoundError('Open shift');
  shift.clockOutAt = new Date();
  shift.closingCount = closingCount;
  await shift.save();
  return shift;
}

// ── Routes ────────────────────────────────────────────────────────────────
export const employeesRouter: Router = Router();

employeesRouter.get('/', requireAuth, requirePermission('employees:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const q = z.object({ branchId: objectIdSchema.optional(), role: z.string().optional() }).parse(req.query);
    res.json({ items: await listEmployees(req.tenantId, q) });
  }));

employeesRouter.post('/', requireAuth, requirePermission('employees:write'),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await createEmployee(req.tenantId, createEmployeeSchema.parse(req.body)));
  }));

employeesRouter.post('/:id/clock-in', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { branchId, openingFloat } = z.object({ branchId: objectIdSchema, openingFloat: z.number().int().min(0).default(0) }).parse(req.body);
    res.json(await clockIn(req.tenantId, id, branchId, openingFloat));
  }));

employeesRouter.post('/:id/clock-out', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { closingCount } = z.object({ closingCount: z.number().int().min(0).default(0) }).parse(req.body);
    res.json(await clockOut(id, closingCount));
  }));
