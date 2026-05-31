import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const I18n = { ar: { type: String }, en: { type: String, required: true } };

const GeoPolygonSchema = new Schema(
  { type: { type: String, enum: ['Polygon'], required: true }, coordinates: { type: [[[Number]]], required: true } },
  { _id: false },
);

const OpeningHoursSchema = new Schema(
  { day: { type: Number, min: 0, max: 6, required: true }, open: { type: String, required: true }, close: { type: String, required: true } },
  { _id: false },
);

const DeliveryZoneSchema = new Schema(
  {
    name:        { type: String, required: true },
    polygon:     { type: GeoPolygonSchema, required: true },
    minOrder:    { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    etaMinutes:  { type: Number, default: 30 },
  },
  { _id: true },
);

const AddressSchema = new Schema(
  {
    label: { type: String },
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    district: { type: String, required: true },
    country: { type: String, default: 'SA' },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const BranchSchema = new Schema(
  {
    tenantId:           { type: Schema.Types.ObjectId, required: true, index: true },
    code:               { type: String, required: true },
    name:               I18n,
    address:            { type: AddressSchema, required: true },
    geofence:           GeoPolygonSchema,
    deliveryZones:      [DeliveryZoneSchema],
    openingHours:       [OpeningHoursSchema],
    contact:            { phone: { type: String, required: true }, email: { type: String } },
    taxId:              { type: String, required: true },
    zatcaSerialPrefix:  { type: String, required: true },
    features: {
      dineIn:   { type: Boolean, default: true },
      pickup:   { type: Boolean, default: true },
      delivery: { type: Boolean, default: true },
      takeaway: { type: Boolean, default: true },
    },
    status:        { type: String, enum: ['active', 'paused', 'closed'], default: 'active' },
    managerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    /** Per-day monotonically-increasing order counter, resets at branch midnight. */
    orderSeq: {
      ymd: { type: String, default: '' },     // 'YYYYMMDD'
      n:   { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

BranchSchema.index({ tenantId: 1, code: 1 }, { unique: true });
BranchSchema.index({ tenantId: 1, status: 1 });

export type BranchDoc = InferSchemaType<typeof BranchSchema> & { _id: import('mongoose').Types.ObjectId };
export const BranchModel: Model<BranchDoc> = model<BranchDoc>('Branch', BranchSchema);
