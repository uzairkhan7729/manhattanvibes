import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

const OrderItemSchema = new Schema(
  {
    productId:       { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productSnapshot: { type: Schema.Types.Mixed, required: true },
    qty:             { type: Number, required: true, min: 1 },
    sizeCode:        { type: String },
    crustCode:       { type: String },
    modifiers: [
      {
        type:       { type: String, enum: ['sauce', 'cheese', 'topping', 'addon'], required: true },
        toppingId:  { type: Schema.Types.ObjectId, ref: 'Topping' },
        productId:  { type: Schema.Types.ObjectId, ref: 'Product' },
        qty:        { type: Number, required: true },
        unitPrice:  { type: Number, required: true },
      },
    ],
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    notes:     { type: String },
    state:     { type: String, enum: ['pending', 'preparing', 'ready', 'served'] },
  },
  { _id: true },
);

const PricingSchema = new Schema(
  {
    subtotal:      { type: Number, required: true },
    discountTotal: { type: Number, required: true, default: 0 },
    discountBreakdown: [
      { source: { type: String, enum: ['coupon', 'loyalty', 'manual'] }, amount: Number, ref: String },
    ],
    deliveryFee: { type: Number, default: 0 },
    vatRate:     { type: Number, default: 15 },
    vat:         { type: Number, required: true },
    tip:         { type: Number, default: 0 },
    total:       { type: Number, required: true },
  },
  { _id: false },
);

const DeliverySchema = new Schema(
  {
    addressId:       { type: Schema.Types.ObjectId },
    addressSnapshot: { type: Schema.Types.Mixed },
    zoneId:          { type: Schema.Types.ObjectId },
    driverId:        { type: Schema.Types.ObjectId, ref: 'Driver' },
    etaSeconds:      { type: Number },
    pickedUpAt:      { type: Date },
    deliveredAt:     { type: Date },
    proofOfDelivery: {
      kind: { type: String, enum: ['signature', 'photo', 'otp'] },
      value: { type: String },
    },
  },
  { _id: false },
);

const TransitionSchema = new Schema(
  {
    from:   { type: String, required: true },
    to:     { type: String, required: true },
    by:     { type: Schema.Types.ObjectId, ref: 'User' },
    ts:     { type: Date, default: Date.now },
    reason: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    branchId:    { type: Schema.Types.ObjectId, required: true, index: true },
    orderNumber: { type: String, required: true },
    channel:     { type: String, enum: ['pos', 'web', 'mobile', 'phone', 'aggregator'], required: true },
    type:        { type: String, enum: ['dinein', 'takeaway', 'delivery', 'pickup'], required: true },
    customerId:  { type: Schema.Types.ObjectId, ref: 'User' },
    guestInfo:   { name: String, phone: String },
    tableId:     { type: Schema.Types.ObjectId, ref: 'Table' },
    state:       { type: String, required: true, default: 'CREATED', index: true },
    items:       { type: [OrderItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    pricing:     { type: PricingSchema, required: true },
    payments:    [{ type: Schema.Types.ObjectId, ref: 'Payment' }],
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid', 'refunded', 'failed'], default: 'unpaid' },
    delivery:    DeliverySchema,
    invoice: {
      zatcaUuid:   { type: String },
      invoiceHash: { type: String },
      qrPayload:   { type: String },
      pdfUrl:      { type: String },
      clearedAt:   { type: Date },
    },
    notes:       { type: String },
    promoCodes:  { type: [String], default: [] },
    loyalty: {
      earnedPoints:    { type: Number, default: 0 },
      redeemedPoints:  { type: Number, default: 0 },
      accrualHoldUntil: { type: Date },
    },
    audit: {
      createdBy:    { type: Schema.Types.ObjectId, ref: 'User' },
      createdByRole:{ type: String },
      deviceId:     { type: String },
      transitions:  { type: [TransitionSchema], default: [] },
    },
    clientOpId:   { type: String, sparse: true },
    syncedAt:     { type: Date },
    closedAt:     { type: Date },
    version:      { type: Number, default: 0 },
  },
  { timestamps: true },
);

OrderSchema.index({ tenantId: 1, branchId: 1, orderNumber: 1 }, { unique: true });
OrderSchema.index({ tenantId: 1, branchId: 1, state: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
OrderSchema.index({ 'delivery.driverId': 1, state: 1 });
// Sparse compound indexes still index docs where the field is null — use a
// partial filter so this only applies when clientOpId is actually a string.
OrderSchema.index(
  { clientOpId: 1, branchId: 1 },
  { unique: true, partialFilterExpression: { clientOpId: { $type: 'string' } } },
);
OrderSchema.index({ tenantId: 1, createdAt: -1 });

export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: Types.ObjectId };
export const OrderModel: Model<OrderDoc> = model<OrderDoc>('Order', OrderSchema);
