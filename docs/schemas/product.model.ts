import { Schema, model } from 'mongoose';

const I18nText = new Schema({ ar: String, en: { type: String, required: true } }, { _id: false });

const SizeSchema = new Schema({
  code:        { type: String, enum: ['S', 'M', 'L', 'XL'], required: true },
  priceDelta:  { type: Number, required: true },
  maxToppings: { type: Number, default: 5 },
}, { _id: false });

const CrustSchema = new Schema({
  code:       { type: String, required: true },
  name:       { type: I18nText, required: true },
  priceDelta: { type: Number, required: true },
}, { _id: false });

const ComboComponentSchema = new Schema({
  productId:     { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  qty:           { type: Number, required: true },
  swappableWith: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
}, { _id: false });

const NutritionSchema = new Schema({
  calories: Number, protein: Number, carbs: Number, fat: Number, sodium: Number,
}, { _id: false });

const BranchOverrideSchema = new Schema({
  price:        Number,
  isActive:     Boolean,
  isAvailable:  Boolean,
}, { _id: false });

const ProductSchema = new Schema({
  tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
  sku:         { type: String, required: true },
  categoryId:  { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  name:        { type: I18nText, required: true },
  description: { type: I18nText },
  images: [{
    url: { type: String, required: true },
    alt: I18nText,
  }],
  type:        { type: String, enum: ['simple', 'configurable', 'combo'], required: true },
  basePrice:   { type: Number, required: true },
  sizes:       [SizeSchema],
  crusts:      [CrustSchema],
  sauces:      [{ type: Schema.Types.ObjectId, ref: 'Topping' }],
  toppings:    [{ type: Schema.Types.ObjectId, ref: 'Topping' }],
  components:  [ComboComponentSchema],
  isVeg:       { type: Boolean, default: false },
  allergens:   [{ type: String }],
  spicyLevel:  { type: Number, min: 0, max: 3, default: 0 },
  nutrition:   NutritionSchema,
  vatRate:     { type: Number, default: 15 },
  isActive:    { type: Boolean, default: true },
  branchOverrides: { type: Map, of: BranchOverrideSchema, default: undefined },
  version:     { type: Number, default: 0 },
  deletedAt:   { type: Date, sparse: true },
}, { timestamps: true });

ProductSchema.index({ tenantId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ tenantId: 1, categoryId: 1, isActive: 1 });
ProductSchema.index({ 'name.en': 'text', 'name.ar': 'text' });

export const Product = model('Product', ProductSchema);
