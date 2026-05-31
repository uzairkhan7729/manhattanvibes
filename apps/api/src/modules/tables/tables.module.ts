/**
 * Tables — dine-in support. Combined model/service/routes file.
 *
 * Merge: keeps the lowest-id table as the host; others marked 'occupied' but
 *        share host's currentOrderId.
 * Split: order-side concern (handled in orders module) — this module only
 *        re-points table.currentOrderId.
 * Transfer: changes section / waiter assignment.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type HydratedDocument, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

const TableSchema = new Schema(
  {
    tenantId:        { type: Schema.Types.ObjectId, required: true, index: true },
    branchId:        { type: Schema.Types.ObjectId, required: true, index: true },
    code:            { type: String, required: true },
    seats:           { type: Number, required: true, default: 4 },
    section:         { type: String },
    status:          { type: String, enum: ['free', 'occupied', 'reserved', 'cleaning'], default: 'free' },
    currentOrderId:  { type: Schema.Types.ObjectId, ref: 'Order' },
    mergedWith:      [{ type: Schema.Types.ObjectId, ref: 'Table' }], // when this table hosts a merge
  },
  { timestamps: true },
);
TableSchema.index({ tenantId: 1, branchId: 1, code: 1 }, { unique: true });

type TableDoc = InferSchemaType<typeof TableSchema> & { _id: Types.ObjectId };
const TableModel: Model<TableDoc> = model<TableDoc>('Table', TableSchema);

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

export async function getTable(tenantId: string, id: string): Promise<HydratedDocument<TableDoc>> {
  const doc = await TableModel.findOne({ _id: tid(id), tenantId: tid(tenantId) }).exec();
  if (!doc) throw new NotFoundError('Table');
  return doc;
}

export const tablesRouter: Router = Router();

tablesRouter.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { branchId } = z.object({ branchId: objectIdSchema }).parse(req.query);
  const items = await TableModel.find({ tenantId: tid(req.tenantId), branchId: tid(branchId) }).lean().exec();
  res.json({ items });
}));

const createSchema = z.object({
  branchId: objectIdSchema,
  code:     z.string().min(1),
  seats:    z.number().int().min(1),
  section:  z.string().optional(),
});
tablesRouter.post('/', requireAuth, requirePermission('branches:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    const dupe = await TableModel.exists({ tenantId: tid(req.tenantId), branchId: tid(input.branchId), code: input.code });
    if (dupe) throw new ConflictError('table-exists', `Table ${input.code} already exists`);
    res.status(201).json(await TableModel.create({ ...input, tenantId: tid(req.tenantId), branchId: tid(input.branchId) }));
  }));

const statusSchema = z.object({ status: z.enum(['free', 'occupied', 'reserved', 'cleaning']) });
tablesRouter.patch('/:id/status', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { status } = statusSchema.parse(req.body);
    const doc = await TableModel.findOneAndUpdate({ _id: tid(id), tenantId: tid(req.tenantId) }, { $set: { status } }, { new: true }).exec();
    if (!doc) throw new NotFoundError('Table');
    res.json(doc);
  }));

const assignSchema = z.object({ orderId: objectIdSchema });
tablesRouter.post('/:id/assign', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { orderId } = assignSchema.parse(req.body);
    const doc = await TableModel.findOneAndUpdate(
      { _id: tid(id), tenantId: tid(req.tenantId) },
      { $set: { currentOrderId: tid(orderId), status: 'occupied' } },
      { new: true },
    ).exec();
    if (!doc) throw new NotFoundError('Table');
    res.json(doc);
  }));

const mergeSchema = z.object({ hostId: objectIdSchema, mergeIds: z.array(objectIdSchema).min(1) });
tablesRouter.post('/merge', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { hostId, mergeIds } = mergeSchema.parse(req.body);
    if (mergeIds.includes(hostId)) throw new ValidationError({ mergeIds: 'host cannot be in mergeIds' });
    const host = await getTable(req.tenantId, hostId);
    await TableModel.updateMany(
      { _id: { $in: mergeIds.map(tid) }, tenantId: tid(req.tenantId) },
      { $set: { status: 'occupied', currentOrderId: host.currentOrderId } },
    );
    host.mergedWith = [...(host.mergedWith ?? []), ...mergeIds.map(tid)];
    host.status = 'occupied';
    await host.save();
    res.json(host);
  }));

tablesRouter.post('/:id/transfer', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { section } = z.object({ section: z.string() }).parse(req.body);
    const doc = await TableModel.findOneAndUpdate({ _id: tid(id), tenantId: tid(req.tenantId) }, { $set: { section } }, { new: true }).exec();
    if (!doc) throw new NotFoundError('Table');
    res.json(doc);
  }));
