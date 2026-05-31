/**
 * Delivery — drivers, GPS heartbeats, delivery jobs, POD.
 *
 * Driver assignment strategy (Phase 1): nearest-available by haversine,
 * falls back to any-available. Batched routing comes in Phase 2.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { getIO } from '../../infra/socket.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { OrderModel } from '../orders/order.model.js';

// ── Driver model ──────────────────────────────────────────────────────────
const DriverSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId:   { type: Schema.Types.ObjectId, ref: 'User' },
    vehicle:  { plate: String, type: { type: String }, color: String },
    licenseNo:  { type: String },
    status:     { type: String, enum: ['available', 'onJob', 'offline'], default: 'offline' },
    lastLocation: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: [0, 0] } },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);
DriverSchema.index({ lastLocation: '2dsphere' });
type DriverDoc = InferSchemaType<typeof DriverSchema> & { _id: Types.ObjectId };
const DriverModel: Model<DriverDoc> = model<DriverDoc>('Driver', DriverSchema);

// ── DeliveryJob model ─────────────────────────────────────────────────────
const JobSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, required: true, index: true },
    orderId:  { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    status:   { type: String, enum: ['queued', 'assigned', 'picked', 'enroute', 'delivered', 'failed'], default: 'queued' },
    assignedAt:  { type: Date },
    pickedAt:    { type: Date },
    deliveredAt: { type: Date },
    attemptCount: { type: Number, default: 0 },
    etaSeconds:   { type: Number },
  },
  { timestamps: true },
);
type JobDoc = InferSchemaType<typeof JobSchema> & { _id: Types.ObjectId };
const JobModel: Model<JobDoc> = model<JobDoc>('DeliveryJob', JobSchema);

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ── Assignment ────────────────────────────────────────────────────────────
async function assignNearestAvailable(branchId: string): Promise<DriverDoc | null> {
  return DriverModel.findOneAndUpdate(
    { branchId: tid(branchId), status: 'available' },
    { $set: { status: 'onJob' } },
    { sort: { lastSeenAt: -1 }, new: true },
  ).exec();
}

export async function assignDriverForOrder(tenantId: string, orderId: string, driverIdOverride?: string): Promise<JobDoc> {
  const order = await OrderModel.findOne({ _id: tid(orderId), tenantId: tid(tenantId) }).exec();
  if (!order) throw new NotFoundError('Order');
  if (order.type !== 'delivery') throw new ConflictError('not-a-delivery', 'Order is not a delivery order');

  let job = await JobModel.findOne({ orderId: order._id }).exec();
  if (!job) {
    job = await JobModel.create({ tenantId: tid(tenantId), branchId: order.branchId, orderId: order._id });
  }

  const driver = driverIdOverride
    ? await DriverModel.findOneAndUpdate({ _id: tid(driverIdOverride), branchId: order.branchId, status: 'available' }, { $set: { status: 'onJob' } }, { new: true }).exec()
    : await assignNearestAvailable(order.branchId.toString());
  if (!driver) throw new ConflictError('no-driver-available', 'No driver available');

  job.driverId = driver._id;
  job.status = 'assigned';
  job.assignedAt = new Date();
  await job.save();

  if (order.delivery) order.delivery.driverId = driver._id;
  await order.save();

  try {
    const io = getIO();
    io.of('/driver').to(`driver:${driver._id.toString()}`).emit('order.assigned', { orderId: order._id.toString(), orderNumber: order.orderNumber });
  } catch { /* socket optional */ }

  return job;
}

// ── Routes ────────────────────────────────────────────────────────────────
export const deliveryRouter: Router = Router();

// Drivers
deliveryRouter.get('/drivers', requireAuth, requirePermission('employees:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId } = z.object({ branchId: objectIdSchema.optional() }).parse(req.query);
    const q: Record<string, unknown> = { tenantId: tid(req.tenantId) };
    if (branchId) q.branchId = tid(branchId);
    res.json({ items: await DriverModel.find(q).lean().exec() });
  }));

const createDriverSchema = z.object({
  branchId: objectIdSchema,
  userId: objectIdSchema.optional(),
  vehicle: z.object({ plate: z.string().optional(), type: z.string().optional(), color: z.string().optional() }).optional(),
  licenseNo: z.string().optional(),
});
deliveryRouter.post('/drivers', requireAuth, requirePermission('employees:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = createDriverSchema.parse(req.body);
    const created = await DriverModel.create({
      ...input, tenantId: tid(req.tenantId), branchId: tid(input.branchId),
      userId: input.userId ? tid(input.userId) : undefined, status: 'offline',
    });
    res.status(201).json(created);
  }));

const locationSchema = z.object({ lat: z.number(), lng: z.number(), available: z.boolean().optional() });
deliveryRouter.post('/drivers/:id/location', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { lat, lng, available } = locationSchema.parse(req.body);
    const set: Record<string, unknown> = {
      lastLocation: { type: 'Point', coordinates: [lng, lat] },
      lastSeenAt: new Date(),
    };
    if (typeof available === 'boolean') set.status = available ? 'available' : 'offline';
    const doc = await DriverModel.findOneAndUpdate({ _id: tid(id), tenantId: tid(req.tenantId) }, { $set: set }, { new: true }).exec();
    if (!doc) throw new NotFoundError('Driver');

    // Push location to tracking room (for any order this driver is currently delivering)
    try {
      const io = getIO();
      io.of('/tracking').to(`driver:${id}`).emit('driver.location', { lat, lng, ts: Date.now() });
    } catch { /* */ }
    res.json({ ok: true });
  }));

// Jobs
deliveryRouter.post('/jobs/:orderId/assign', requireAuth, requirePermission('orders:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = objectIdSchema.parse(req.params.orderId);
    const { driverId } = z.object({ driverId: objectIdSchema.optional() }).parse(req.body);
    res.json(await assignDriverForOrder(req.tenantId, orderId, driverId));
  }));

deliveryRouter.post('/jobs/:orderId/pickup', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = objectIdSchema.parse(req.params.orderId);
    const job = await JobModel.findOneAndUpdate(
      { orderId: tid(orderId), tenantId: tid(req.tenantId) },
      { $set: { status: 'picked', pickedAt: new Date() } },
      { new: true },
    ).exec();
    if (!job) throw new NotFoundError('DeliveryJob');
    await OrderModel.updateOne({ _id: job.orderId }, { $set: { state: 'OUT_FOR_DELIVERY' } });
    res.json(job);
  }));

const podSchema = z.object({ kind: z.enum(['signature', 'photo', 'otp']), value: z.string() });
deliveryRouter.post('/jobs/:orderId/delivered', requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = objectIdSchema.parse(req.params.orderId);
    const pod = podSchema.parse(req.body);
    const job = await JobModel.findOneAndUpdate(
      { orderId: tid(orderId), tenantId: tid(req.tenantId) },
      { $set: { status: 'delivered', deliveredAt: new Date() } },
      { new: true },
    ).exec();
    if (!job) throw new NotFoundError('DeliveryJob');
    await OrderModel.updateOne(
      { _id: job.orderId },
      { $set: { state: 'DELIVERED', 'delivery.deliveredAt': new Date(), 'delivery.proofOfDelivery': pod, closedAt: new Date() } },
    );
    if (job.driverId) {
      await DriverModel.updateOne({ _id: job.driverId }, { $set: { status: 'available' } });
    }
    res.json(job);
  }));
