import { Schema, model, Types, type InferSchemaType, type Model } from 'mongoose';

const PaymentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, required: true, index: true },
    orderId:  { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    method:   { type: String, enum: ['cash', 'mada', 'visa', 'mastercard', 'applepay', 'stcpay', 'wallet', 'loyalty'], required: true },
    amount:   { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    status:   { type: String, enum: ['authorized', 'captured', 'failed', 'voided', 'refunded', 'partial-refunded'], required: true },
    gateway:  { type: String, enum: ['hyperpay', 'moyasar', 'checkout', 'stcpay-native', 'cash', 'sandbox'] },
    gatewayRefs: {
      txnId:    { type: String },
      authCode: { type: String },
      last4:    { type: String },
      brand:    { type: String },
      threeDS:  { type: String },
      raw:      { type: Schema.Types.Mixed },
    },
    refunds: [
      {
        amount:           { type: Number, required: true },
        reason:           { type: String, required: true },
        refundedAt:       { type: Date, default: Date.now },
        byUserId:         { type: Schema.Types.ObjectId, ref: 'User' },
        gatewayRefundId:  { type: String },
      },
    ],
    capturedAt: { type: Date },
  },
  { timestamps: true },
);
PaymentSchema.index({ 'gatewayRefs.txnId': 1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: Types.ObjectId };
export const PaymentModel: Model<PaymentDoc> = model<PaymentDoc>('Payment', PaymentSchema);
