import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * OTP records are short-lived (TTL via expiresAt index). Codes are stored
 * hashed (SHA-256) — never plaintext.
 */
const OtpSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, required: true, index: true },
    phone:      { type: String, required: true, index: true }, // E.164
    purpose:    { type: String, enum: ['login', 'register', 'verify', 'reset'], required: true },
    hashedCode: { type: String, required: true },
    attempts:   { type: Number, default: 0 },
    consumedAt: { type: Date },
    expiresAt:  { type: Date, required: true },
    createdAt:  { type: Date, default: Date.now },
  },
  { timestamps: false },
);

OtpSchema.index({ phone: 1, purpose: 1, consumedAt: 1 });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type OtpDoc = InferSchemaType<typeof OtpSchema> & { _id: import('mongoose').Types.ObjectId };

export const OtpModel: Model<OtpDoc> = model<OtpDoc>('Otp', OtpSchema);
