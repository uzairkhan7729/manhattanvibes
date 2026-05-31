import type { Id, Iso8601, I18nText, Halalas } from './common.js';

export type ProductType = 'simple' | 'configurable' | 'combo';
export type SizeCode = 'S' | 'M' | 'L' | 'XL';

export interface ProductImage {
  url: string;
  alt?: I18nText;
}

export interface ProductSize {
  code: SizeCode;
  priceDelta: Halalas;
  maxToppings: number;
}

export interface ProductCrust {
  code: string;
  name: I18nText;
  priceDelta: Halalas;
}

export interface ComboComponent {
  productId: Id;
  qty: number;
  swappableWith?: Id[];
}

export interface NutritionFacts {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  sodium?: number;
}

export interface BranchOverride {
  price?: Halalas;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface Product {
  _id: Id;
  tenantId: Id;
  sku: string;
  categoryId: Id;
  name: I18nText;
  description?: I18nText;
  images: ProductImage[];
  type: ProductType;
  basePrice: Halalas;
  sizes?: ProductSize[];
  crusts?: ProductCrust[];
  sauces?: Id[];
  toppings?: Id[];
  components?: ComboComponent[];
  isVeg: boolean;
  allergens: string[];
  spicyLevel: 0 | 1 | 2 | 3;
  nutrition?: NutritionFacts;
  vatRate: number;
  isActive: boolean;
  branchOverrides?: Record<Id, BranchOverride>;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface Category {
  _id: Id;
  tenantId: Id;
  parentId?: Id;
  name: I18nText;
  slug: string;
  image?: string;
  displayOrder: number;
  isActive: boolean;
}
