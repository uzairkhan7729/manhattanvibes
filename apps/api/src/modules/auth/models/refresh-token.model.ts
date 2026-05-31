import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

/**
 * Refresh tokens are stored **hashed** (SHA-256). The plaintext only lives in
 * the response body once. Rotation produces a new `jti` in the same `family`
 * and revokes the prior one; reuse of a revoked jti triggers family revocation.
 */
const RefreshTokenSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, required: true, index: true },
    userId:      { type: Schema.Types.ObjectId, required: true, index: true },
    jti:         { type: String, required: true, unique: true },
    family:      { type: String, required: true, index: true },
    hashedToken: { type: String, required: true },
    deviceId:    { type: String },
    userAgent:   { type: String },
    ip:          { type: String },
    issuedAt:    { type: Date, default: Date.now },
    expiresAt:   { type: Date, required: true },
    revokedAt:   { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: false },
);

// TTL — Mongo will purge entries past expiresAt; we keep a 30-day grace via expireAfterSeconds offset.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
RefreshTokenSchema.index({ userId: 1, family: 1 });

export type RefreshTokenDoc = InferSchemaType<typeof RefreshTokenSchema> & { _id: import('mongoose').Types.ObjectId };

export const RefreshTokenModel: Model<RefreshTokenDoc> = model<RefreshTokenDoc>('RefreshToken', RefreshTokenSchema);
