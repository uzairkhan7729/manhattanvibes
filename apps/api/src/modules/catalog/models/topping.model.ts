import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const I18n = { ar: { type: String }, en: { type: String, required: true } };

const ToppingSchema = new Schema(
  {
    tenantId:  { type: Schema.Types.ObjectId, required: true, index: true },
    name:      I18n,
    category:  { type: String, enum: ['sauce', 'cheese', 'meat', 'veg'], required: true, index: true },
    basePrice: { type: Number, required: true },  // halalas
    image:     { type: String },
    isActive:  { type: Boolean, default: true },
    recipeIngredients: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: 'InventoryItem' },
        qty:    { type: Number },
      },
    ],
  },
  { timestamps: true },
);

ToppingSchema.index({ tenantId: 1, category: 1, isActive: 1 });

export type ToppingDoc = InferSchemaType<typeof ToppingSchema> & { _id: import('mongoose').Types.ObjectId };
export const ToppingModel: Model<ToppingDoc> = model<ToppingDoc>('Topping', ToppingSchema);
