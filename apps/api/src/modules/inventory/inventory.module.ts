/**
 * Inventory — items, per-branch stock, recipes, POs, GRN, waste.
 * Single-file because the surface is moderate and the entities share fate.
 */
import { Router, type Request, type Response } from 'express';
import { Schema, Types, model, type InferSchemaType, type Model } from 'mongoose';
import { z } from 'zod';

import { i18nTextSchema, objectIdSchema } from '@mv/validators';

import { requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// ── Models ────────────────────────────────────────────────────────────────
const ItemSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    name:     { ar: String, en: { type: String, required: true } },
    sku:      { type: String, required: true },
    unit:     { type: String, enum: ['kg', 'g', 'L', 'ml', 'pcs'], required: true },
    unitCost: { type: Number, default: 0 },               // halalas per unit
    reorderLevel: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    softNegative: { type: Boolean, default: false },      // can go negative (with alert)
  },
  { timestamps: true },
);
ItemSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
type ItemDoc = InferSchemaType<typeof ItemSchema> & { _id: Types.ObjectId };
const ItemModel: Model<ItemDoc> = model<ItemDoc>('InventoryItem', ItemSchema);

const StockSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    branchId:    { type: Schema.Types.ObjectId, required: true, index: true },
    itemId:      { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    qtyOnHand:   { type: Number, default: 0 },
    qtyReserved: { type: Number, default: 0 },
    lastCountAt: { type: Date },
  },
  { timestamps: true },
);
StockSchema.index({ tenantId: 1, branchId: 1, itemId: 1 }, { unique: true });
type StockDoc = InferSchemaType<typeof StockSchema> & { _id: Types.ObjectId };
const StockModel: Model<StockDoc> = model<StockDoc>('InventoryStock', StockSchema);

const RecipeSchema = new Schema(
  {
    tenantId:  { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
        qty:    { type: Number, required: true },
        unit:   { type: String, enum: ['kg', 'g', 'L', 'ml', 'pcs'], required: true },
      },
    ],
  },
  { timestamps: true },
);
type RecipeDoc = InferSchemaType<typeof RecipeSchema> & { _id: Types.ObjectId };
const RecipeModel: Model<RecipeDoc> = model<RecipeDoc>('Recipe', RecipeSchema);

const POSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, required: true, index: true },
    vendorId: { type: Schema.Types.ObjectId },
    lines: [{ itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem' }, qty: Number, unitCost: Number }],
    status:   { type: String, enum: ['draft', 'sent', 'received', 'cancelled'], default: 'draft' },
    expectedDate: Date,
    totalCost:    { type: Number, default: 0 },
  },
  { timestamps: true },
);
type PODoc = InferSchemaType<typeof POSchema> & { _id: Types.ObjectId };
const POModel: Model<PODoc> = model<PODoc>('PurchaseOrder', POSchema);

const WasteSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, required: true, index: true },
    itemId:   { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    qty:      { type: Number, required: true },
    reason:   { type: String, enum: ['overcooked', 'expired', 'dropped', 'spillage', 'customer-return', 'training', 'other'], required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    ts:       { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);
type WasteDoc = InferSchemaType<typeof WasteSchema> & { _id: Types.ObjectId };
const WasteModel: Model<WasteDoc> = model<WasteDoc>('WasteLog', WasteSchema);

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ── Services ──────────────────────────────────────────────────────────────
export async function consumeForOrderItems(tenantId: string, branchId: string, lines: { productId: string; qty: number }[]): Promise<void> {
  for (const line of lines) {
    const recipe = await RecipeModel.findOne({ tenantId: tid(tenantId), productId: tid(line.productId) }).exec();
    if (!recipe) continue;
    for (const part of recipe.items) {
      const delta = -part.qty * line.qty;
      await StockModel.updateOne(
        { tenantId: tid(tenantId), branchId: tid(branchId), itemId: part.itemId },
        { $inc: { qtyOnHand: delta } },
        { upsert: true },
      );
    }
  }
}

// ── Routes ────────────────────────────────────────────────────────────────
export const inventoryRouter: Router = Router();

// Items
inventoryRouter.get('/items', requireAuth, requirePermission('inventory:read'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ items: await ItemModel.find({ tenantId: tid(req.tenantId), isActive: true }).lean().exec() });
  }));

const itemSchema = z.object({
  name: i18nTextSchema,
  sku: z.string().min(1),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'pcs']),
  unitCost: z.number().int().min(0).optional(),
  reorderLevel: z.number().min(0).optional(),
  softNegative: z.boolean().optional(),
});
inventoryRouter.post('/items', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = itemSchema.parse(req.body);
    const dupe = await ItemModel.exists({ tenantId: tid(req.tenantId), sku: input.sku });
    if (dupe) throw new ConflictError('sku-exists', `SKU "${input.sku}" already in use`);
    res.status(201).json(await ItemModel.create({ ...input, tenantId: tid(req.tenantId) }));
  }));

// Stock
inventoryRouter.get('/stock', requireAuth, requirePermission('inventory:read'),
  asyncHandler(async (req: Request, res: Response) => {
    const { branchId } = z.object({ branchId: objectIdSchema }).parse(req.query);
    const stock = await StockModel.find({ tenantId: tid(req.tenantId), branchId: tid(branchId) }).populate('itemId').lean().exec();
    res.json({ items: stock });
  }));

const adjustSchema = z.object({ branchId: objectIdSchema, itemId: objectIdSchema, delta: z.number(), reason: z.string().min(1) });
inventoryRouter.post('/stock/adjust', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = adjustSchema.parse(req.body);
    const doc = await StockModel.findOneAndUpdate(
      { tenantId: tid(req.tenantId), branchId: tid(input.branchId), itemId: tid(input.itemId) },
      { $inc: { qtyOnHand: input.delta } },
      { upsert: true, new: true },
    ).exec();
    res.json(doc);
  }));

// Recipes
const recipeSchema = z.object({
  productId: objectIdSchema,
  items: z.array(z.object({ itemId: objectIdSchema, qty: z.number().positive(), unit: z.enum(['kg', 'g', 'L', 'ml', 'pcs']) })),
});
inventoryRouter.post('/recipes', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = recipeSchema.parse(req.body);
    const doc = await RecipeModel.findOneAndUpdate(
      { tenantId: tid(req.tenantId), productId: tid(input.productId) },
      { $set: { items: input.items.map((i) => ({ ...i, itemId: tid(i.itemId) })) } },
      { upsert: true, new: true },
    ).exec();
    res.json(doc);
  }));

// Waste
const wasteSchema = z.object({
  branchId: objectIdSchema, itemId: objectIdSchema, qty: z.number().positive(),
  reason: z.enum(['overcooked', 'expired', 'dropped', 'spillage', 'customer-return', 'training', 'other']),
});
inventoryRouter.post('/waste', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = wasteSchema.parse(req.body);
    const w = await WasteModel.create({ ...input, tenantId: tid(req.tenantId), byUserId: req.auth?.userId ? tid(req.auth.userId) : undefined });
    await StockModel.updateOne(
      { tenantId: tid(req.tenantId), branchId: tid(input.branchId), itemId: tid(input.itemId) },
      { $inc: { qtyOnHand: -input.qty } },
      { upsert: true },
    );
    res.status(201).json(w);
  }));

// Purchase Orders
const poSchema = z.object({
  branchId: objectIdSchema,
  vendorId: objectIdSchema.optional(),
  lines: z.array(z.object({ itemId: objectIdSchema, qty: z.number().positive(), unitCost: z.number().min(0) })).min(1),
  expectedDate: z.string().datetime().optional(),
});
inventoryRouter.post('/po', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const input = poSchema.parse(req.body);
    const totalCost = input.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);
    res.status(201).json(await POModel.create({
      ...input, tenantId: tid(req.tenantId),
      lines: input.lines.map((l) => ({ ...l, itemId: tid(l.itemId) })),
      vendorId: input.vendorId ? tid(input.vendorId) : undefined,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : undefined,
      totalCost,
    }));
  }));

inventoryRouter.post('/po/:id/receive', requireAuth, requirePermission('inventory:write'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const po = await POModel.findOne({ _id: tid(id), tenantId: tid(req.tenantId) }).exec();
    if (!po) throw new NotFoundError('PurchaseOrder');
    if (po.status !== 'sent' && po.status !== 'draft') throw new ValidationError({ status: `Cannot receive from ${po.status}` });

    // Apply to stock.
    for (const line of po.lines ?? []) {
      await StockModel.updateOne(
        { tenantId: tid(req.tenantId), branchId: po.branchId, itemId: line.itemId },
        { $inc: { qtyOnHand: line.qty ?? 0 } },
        { upsert: true },
      );
    }
    po.status = 'received';
    await po.save();
    res.json(po);
  }));
