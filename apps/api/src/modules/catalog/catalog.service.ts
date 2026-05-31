import { Types } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { Halalas } from '../../shared/utils/halalas.js';

import { CategoryModel, type CategoryDoc } from './models/category.model.js';
import { ProductModel, type ProductDoc } from './models/product.model.js';
import { ToppingModel, type ToppingDoc } from './models/topping.model.js';

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

// ──────────────────────────────────────────────────────────────────────────
// Categories
// ──────────────────────────────────────────────────────────────────────────

export async function listCategories(tenantId: string): Promise<CategoryDoc[]> {
  return CategoryModel.find({ tenantId: tid(tenantId), deletedAt: { $exists: false } })
    .sort({ displayOrder: 1 })
    .lean<CategoryDoc[]>()
    .exec();
}

export async function createCategory(tenantId: string, input: { name: { ar?: string; en: string }; slug: string; parentId?: string; image?: string; displayOrder?: number }): Promise<CategoryDoc> {
  const exists = await CategoryModel.exists({ tenantId: tid(tenantId), slug: input.slug });
  if (exists) throw new ConflictError('category-slug-exists', `Slug "${input.slug}" already in use`);
  return CategoryModel.create({ ...input, tenantId: tid(tenantId), parentId: input.parentId ? tid(input.parentId) : undefined });
}

export async function updateCategory(tenantId: string, id: string, patch: Partial<{ name: { ar?: string; en: string }; slug: string; image: string; displayOrder: number; isActive: boolean }>): Promise<CategoryDoc> {
  const doc = await CategoryModel.findOneAndUpdate(
    { _id: tid(id), tenantId: tid(tenantId) },
    { $set: patch },
    { new: true },
  ).exec();
  if (!doc) throw new NotFoundError('Category');
  return doc;
}

export async function deleteCategory(tenantId: string, id: string): Promise<void> {
  const res = await CategoryModel.updateOne({ _id: tid(id), tenantId: tid(tenantId) }, { $set: { deletedAt: new Date() } }).exec();
  if (res.matchedCount === 0) throw new NotFoundError('Category');
}

// ──────────────────────────────────────────────────────────────────────────
// Toppings
// ──────────────────────────────────────────────────────────────────────────

export async function listToppings(tenantId: string, opts?: { category?: 'sauce' | 'cheese' | 'meat' | 'veg' }): Promise<ToppingDoc[]> {
  const q: Record<string, unknown> = { tenantId: tid(tenantId), isActive: true };
  if (opts?.category) q.category = opts.category;
  return ToppingModel.find(q).lean<ToppingDoc[]>().exec();
}

export async function createTopping(tenantId: string, input: { name: { ar?: string; en: string }; category: 'sauce' | 'cheese' | 'meat' | 'veg'; basePrice: Halalas; image?: string }): Promise<ToppingDoc> {
  return ToppingModel.create({ ...input, tenantId: tid(tenantId) });
}

// ──────────────────────────────────────────────────────────────────────────
// Products
// ──────────────────────────────────────────────────────────────────────────

export interface ProductView {
  product: ProductDoc;
  /** Effective price after branch overrides for the requested branch. */
  effectivePrice: Halalas;
  /** Whether the product is currently sellable at the requested branch. */
  isAvailable: boolean;
}

function applyBranchOverride(p: ProductDoc, branchId?: string): { price: Halalas; isActive: boolean; isAvailable: boolean } {
  let price = p.basePrice;
  let isActive = p.isActive ?? true;
  let isAvailable = true;
  if (branchId && p.branchOverrides) {
    // Map<string, ...> from Mongoose: use .get()
    const overrides = p.branchOverrides as unknown as Map<string, { price?: number; isActive?: boolean; isAvailable?: boolean }>;
    const ov = overrides.get?.(branchId);
    if (ov) {
      if (typeof ov.price === 'number') price = ov.price;
      if (typeof ov.isActive === 'boolean') isActive = ov.isActive;
      if (typeof ov.isAvailable === 'boolean') isAvailable = ov.isAvailable;
    }
  }
  return { price, isActive, isAvailable };
}

export async function listProducts(tenantId: string, opts?: { branchId?: string; categoryId?: string; search?: string; limit?: number }): Promise<ProductView[]> {
  const q: Record<string, unknown> = { tenantId: tid(tenantId), deletedAt: { $exists: false } };
  if (opts?.categoryId) q.categoryId = tid(opts.categoryId);
  if (opts?.search) q.$text = { $search: opts.search };

  const docs = await ProductModel.find(q).limit(opts?.limit ?? 200).exec();
  const views: ProductView[] = [];
  for (const doc of docs) {
    const eff = applyBranchOverride(doc, opts?.branchId);
    if (!eff.isActive) continue;
    views.push({ product: doc, effectivePrice: eff.price, isAvailable: eff.isAvailable });
  }
  return views;
}

export async function getProduct(tenantId: string, id: string, branchId?: string): Promise<ProductView> {
  const doc = await ProductModel.findOne({ _id: tid(id), tenantId: tid(tenantId), deletedAt: { $exists: false } }).exec();
  if (!doc) throw new NotFoundError('Product');
  const eff = applyBranchOverride(doc, branchId);
  return { product: doc, effectivePrice: eff.price, isAvailable: eff.isAvailable };
}

export interface CreateProductInput {
  sku: string;
  categoryId: string;
  name: { ar?: string; en: string };
  type: 'simple' | 'configurable' | 'combo';
  basePrice: Halalas;
  description?: { ar?: string; en?: string };
  images?: Array<{ url: string; alt?: { ar?: string; en: string } }>;
  sizes?: Array<{ code: 'S' | 'M' | 'L' | 'XL'; priceDelta: number; maxToppings?: number }>;
  crusts?: Array<{ code: string; name: { ar?: string; en: string }; priceDelta: number }>;
  sauces?: string[];
  toppings?: string[];
  components?: Array<{ productId: string; qty: number; swappableWith?: string[] }>;
  isVeg?: boolean;
  allergens?: string[];
  spicyLevel?: 0 | 1 | 2 | 3;
  vatRate?: number;
  isActive?: boolean;
}

export async function createProduct(tenantId: string, input: CreateProductInput): Promise<ProductDoc> {
  const dupe = await ProductModel.exists({ tenantId: tid(tenantId), sku: input.sku });
  if (dupe) throw new ConflictError('sku-exists', `SKU "${input.sku}" already in use`);
  const doc = await ProductModel.create({
    ...input,
    tenantId: tid(tenantId),
    categoryId: tid(input.categoryId),
    sauces:   input.sauces?.map(tid),
    toppings: input.toppings?.map(tid),
    components: input.components?.map((c) => ({ ...c, productId: tid(c.productId), swappableWith: c.swappableWith?.map(tid) })),
  });
  return doc;
}

export async function updateProduct(tenantId: string, id: string, patch: Partial<CreateProductInput>): Promise<ProductDoc> {
  const set: Record<string, unknown> = { ...patch };
  if (patch.categoryId) set.categoryId = tid(patch.categoryId);
  if (patch.sauces)     set.sauces   = patch.sauces.map(tid);
  if (patch.toppings)   set.toppings = patch.toppings.map(tid);
  if (patch.components) set.components = patch.components.map((c) => ({ ...c, productId: tid(c.productId), swappableWith: c.swappableWith?.map(tid) }));

  const doc = await ProductModel.findOneAndUpdate(
    { _id: tid(id), tenantId: tid(tenantId) },
    { $set: set, $inc: { version: 1 } },
    { new: true },
  ).exec();
  if (!doc) throw new NotFoundError('Product');
  return doc;
}

export async function deleteProduct(tenantId: string, id: string): Promise<void> {
  const res = await ProductModel.updateOne({ _id: tid(id), tenantId: tid(tenantId) }, { $set: { deletedAt: new Date() } }).exec();
  if (res.matchedCount === 0) throw new NotFoundError('Product');
}

export async function setBranchOverride(tenantId: string, productId: string, branchId: string, override: { price?: Halalas; isActive?: boolean; isAvailable?: boolean }): Promise<ProductDoc> {
  const doc = await ProductModel.findOneAndUpdate(
    { _id: tid(productId), tenantId: tid(tenantId) },
    { $set: { [`branchOverrides.${branchId}`]: override }, $inc: { version: 1 } },
    { new: true },
  ).exec();
  if (!doc) throw new NotFoundError('Product');
  return doc;
}

// ──────────────────────────────────────────────────────────────────────────
// Pizza-builder pricing
// ──────────────────────────────────────────────────────────────────────────

export interface BuildPricingInput {
  productId: string;
  branchId?: string;
  qty: number;
  sizeCode?: 'S' | 'M' | 'L' | 'XL';
  crustCode?: string;
  toppingIds?: string[];
  sauceIds?: string[];
  addonProductIds?: { productId: string; qty: number }[];
}

export interface BuildPricingResult {
  unitPrice: Halalas;
  lineTotal: Halalas;
  breakdown: {
    base: Halalas;
    sizeDelta: Halalas;
    crustDelta: Halalas;
    toppings: Array<{ toppingId: string; price: Halalas }>;
    sauces: Array<{ toppingId: string; price: Halalas }>;
    addons: Array<{ productId: string; price: Halalas; qty: number }>;
  };
}

/**
 * Authoritative pricing for a single product line. Always run server-side at
 * order quote/place — clients are untrusted.
 */
export async function priceProductLine(tenantId: string, input: BuildPricingInput): Promise<BuildPricingResult> {
  const view = await getProduct(tenantId, input.productId, input.branchId);
  const product = view.product;
  const base = view.effectivePrice;

  let sizeDelta = 0;
  if (product.type === 'configurable') {
    if (!input.sizeCode) throw new ValidationError({ sizeCode: 'required for configurable product' });
    const size = (product.sizes ?? []).find((s) => s.code === input.sizeCode);
    if (!size) throw new ValidationError({ sizeCode: `unknown size ${input.sizeCode}` });
    sizeDelta = size.priceDelta;
  }

  let crustDelta = 0;
  if (input.crustCode) {
    const crust = (product.crusts ?? []).find((c) => c.code === input.crustCode);
    if (!crust) throw new ValidationError({ crustCode: `unknown crust ${input.crustCode}` });
    crustDelta = crust.priceDelta;
  }

  // Toppings — limited by size's maxToppings when configurable.
  let toppingsBreakdown: Array<{ toppingId: string; price: Halalas }> = [];
  if (input.toppingIds && input.toppingIds.length > 0) {
    if (product.type === 'configurable') {
      const size = (product.sizes ?? []).find((s) => s.code === input.sizeCode);
      if (size && input.toppingIds.length > (size.maxToppings ?? 5)) {
        throw new ValidationError({ toppingIds: `exceeds maxToppings (${size.maxToppings})` });
      }
    }
    const toppings = await ToppingModel.find({ tenantId: tid(tenantId), _id: { $in: input.toppingIds.map(tid) }, isActive: true }).exec();
    if (toppings.length !== input.toppingIds.length) throw new ValidationError({ toppingIds: 'one or more toppings invalid' });
    toppingsBreakdown = toppings.map((t) => ({ toppingId: t._id.toString(), price: t.basePrice }));
  }

  let saucesBreakdown: Array<{ toppingId: string; price: Halalas }> = [];
  if (input.sauceIds && input.sauceIds.length > 0) {
    const sauces = await ToppingModel.find({ tenantId: tid(tenantId), _id: { $in: input.sauceIds.map(tid) }, category: 'sauce', isActive: true }).exec();
    if (sauces.length !== input.sauceIds.length) throw new ValidationError({ sauceIds: 'one or more sauces invalid' });
    saucesBreakdown = sauces.map((s) => ({ toppingId: s._id.toString(), price: s.basePrice }));
  }

  let addonsBreakdown: Array<{ productId: string; price: Halalas; qty: number }> = [];
  if (input.addonProductIds && input.addonProductIds.length > 0) {
    const addonViews = await Promise.all(input.addonProductIds.map((a) => getProduct(tenantId, a.productId, input.branchId)));
    addonsBreakdown = addonViews.map((v, i) => ({ productId: v.product._id.toString(), price: v.effectivePrice, qty: input.addonProductIds![i]!.qty }));
  }

  const modifiersTotal =
    toppingsBreakdown.reduce((s, t) => s + t.price, 0) +
    saucesBreakdown.reduce((s, t) => s + t.price, 0) +
    addonsBreakdown.reduce((s, a) => s + a.price * a.qty, 0);

  const unitPrice = base + sizeDelta + crustDelta + modifiersTotal;
  const lineTotal = unitPrice * input.qty;

  return {
    unitPrice,
    lineTotal,
    breakdown: {
      base,
      sizeDelta,
      crustDelta,
      toppings: toppingsBreakdown,
      sauces: saucesBreakdown,
      addons: addonsBreakdown,
    },
  };
}
