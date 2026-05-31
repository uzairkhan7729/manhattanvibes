import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const I18n = { ar: { type: String }, en: { type: String, required: true } };

const CategorySchema = new Schema(
  {
    tenantId:     { type: Schema.Types.ObjectId, required: true, index: true },
    parentId:     { type: Schema.Types.ObjectId, ref: 'Category', index: true },
    name:         I18n,
    slug:         { type: String, required: true },
    image:        { type: String },
    displayOrder: { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true },
    deletedAt:    { type: Date, sparse: true },
  },
  { timestamps: true },
);

CategorySchema.index({ tenantId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ tenantId: 1, parentId: 1, displayOrder: 1 });

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: import('mongoose').Types.ObjectId };
export const CategoryModel: Model<CategoryDoc> = model<CategoryDoc>('Category', CategorySchema);
