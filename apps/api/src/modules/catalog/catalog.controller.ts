import type { Request, Response } from 'express';
import { z } from 'zod';

import { i18nTextSchema, objectIdSchema } from '@mv/validators';

import * as svc from './catalog.service.js';

// ─── Categories ───────────────────────────────────────────────────────────

export async function listCategoriesCtrl(req: Request, res: Response): Promise<void> {
  const items = await svc.listCategories(req.tenantId);
  res.json({ items });
}

const createCategorySchema = z.object({
  name: i18nTextSchema,
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  parentId: objectIdSchema.optional(),
  image: z.string().url().optional(),
  displayOrder: z.number().int().min(0).optional(),
});
export async function createCategoryCtrl(req: Request, res: Response): Promise<void> {
  const input = createCategorySchema.parse(req.body);
  res.status(201).json(await svc.createCategory(req.tenantId, input));
}

const patchCategorySchema = createCategorySchema.partial().extend({ isActive: z.boolean().optional() });
export async function updateCategoryCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  const patch = patchCategorySchema.parse(req.body);
  res.json(await svc.updateCategory(req.tenantId, id, patch));
}

export async function deleteCategoryCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  await svc.deleteCategory(req.tenantId, id);
  res.status(204).end();
}

// ─── Toppings ─────────────────────────────────────────────────────────────

const toppingQuerySchema = z.object({ category: z.enum(['sauce', 'cheese', 'meat', 'veg']).optional() });
export async function listToppingsCtrl(req: Request, res: Response): Promise<void> {
  const q = toppingQuerySchema.parse(req.query);
  res.json({ items: await svc.listToppings(req.tenantId, q) });
}

const createToppingSchema = z.object({
  name: i18nTextSchema,
  category: z.enum(['sauce', 'cheese', 'meat', 'veg']),
  basePrice: z.number().int().min(0),
  image: z.string().url().optional(),
});
export async function createToppingCtrl(req: Request, res: Response): Promise<void> {
  const input = createToppingSchema.parse(req.body);
  res.status(201).json(await svc.createTopping(req.tenantId, input));
}

// ─── Products ─────────────────────────────────────────────────────────────

const productQuerySchema = z.object({
  branchId: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export async function listProductsCtrl(req: Request, res: Response): Promise<void> {
  const q = productQuerySchema.parse(req.query);
  const views = await svc.listProducts(req.tenantId, q);
  res.json({
    items: views.map((v) => ({
      id: v.product._id.toString(),
      sku: v.product.sku,
      name: v.product.name,
      categoryId: v.product.categoryId?.toString(),
      images: v.product.images,
      type: v.product.type,
      effectivePrice: v.effectivePrice,
      isAvailable: v.isAvailable,
      sizes: v.product.sizes,
      crusts: v.product.crusts,
      isVeg: v.product.isVeg,
      spicyLevel: v.product.spicyLevel,
    })),
  });
}

export async function getProductCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  const branchId = req.query.branchId ? objectIdSchema.parse(req.query.branchId) : undefined;
  const view = await svc.getProduct(req.tenantId, id, branchId);
  res.json({ product: view.product, effectivePrice: view.effectivePrice, isAvailable: view.isAvailable });
}

const createProductSchema = z.object({
  sku: z.string().min(1),
  categoryId: objectIdSchema,
  name: i18nTextSchema,
  description: z.object({ ar: z.string().optional(), en: z.string().optional() }).optional(),
  type: z.enum(['simple', 'configurable', 'combo']),
  basePrice: z.number().int().min(0),
  vatRate: z.number().min(0).max(100).optional(),
  sizes: z.array(z.object({ code: z.enum(['S', 'M', 'L', 'XL']), priceDelta: z.number().int(), maxToppings: z.number().int().optional() })).optional(),
  crusts: z.array(z.object({ code: z.string(), name: i18nTextSchema, priceDelta: z.number().int() })).optional(),
  sauces: z.array(objectIdSchema).optional(),
  toppings: z.array(objectIdSchema).optional(),
  components: z.array(z.object({ productId: objectIdSchema, qty: z.number().int().min(1), swappableWith: z.array(objectIdSchema).optional() })).optional(),
  images: z.array(z.object({ url: z.string().url(), alt: i18nTextSchema.optional() })).optional(),
  isVeg: z.boolean().optional(),
  allergens: z.array(z.string()).optional(),
  spicyLevel: z.number().int().min(0).max(3).optional(),
});
export async function createProductCtrl(req: Request, res: Response): Promise<void> {
  const input = createProductSchema.parse(req.body);
  res.status(201).json(await svc.createProduct(req.tenantId, input as svc.CreateProductInput));
}

const patchProductSchema = createProductSchema.partial();
export async function updateProductCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  const patch = patchProductSchema.parse(req.body);
  res.json(await svc.updateProduct(req.tenantId, id, patch as Partial<svc.CreateProductInput>));
}

export async function deleteProductCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  await svc.deleteProduct(req.tenantId, id);
  res.status(204).end();
}

const overrideSchema = z.object({
  branchId: objectIdSchema,
  price: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
});
export async function setBranchOverrideCtrl(req: Request, res: Response): Promise<void> {
  const id = objectIdSchema.parse(req.params.id);
  const { branchId, ...override } = overrideSchema.parse(req.body);
  res.json(await svc.setBranchOverride(req.tenantId, id, branchId, override));
}

const priceQuoteSchema = z.object({
  productId: objectIdSchema,
  branchId: objectIdSchema.optional(),
  qty: z.number().int().min(1),
  sizeCode: z.enum(['S', 'M', 'L', 'XL']).optional(),
  crustCode: z.string().optional(),
  toppingIds: z.array(objectIdSchema).optional(),
  sauceIds: z.array(objectIdSchema).optional(),
  addonProductIds: z.array(z.object({ productId: objectIdSchema, qty: z.number().int().min(1) })).optional(),
});
export async function priceLineCtrl(req: Request, res: Response): Promise<void> {
  const input = priceQuoteSchema.parse(req.body);
  res.json(await svc.priceProductLine(req.tenantId, input));
}
