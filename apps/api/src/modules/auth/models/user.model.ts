import { Schema, model, type InferSchemaType, type Model } from 'mongoose';

const PhoneSchema = new Schema(
  {
    countryCode: { type: String, required: true, default: '+966' },
    number:      { type: String, required: true },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    label:        { type: String, required: true },
    line1:        { type: String, required: true },
    line2:        { type: String },
    city:         { type: String, required: true },
    district:     { type: String, required: true },
    country:      { type: String, default: 'SA', enum: ['SA'] },
    lat:          { type: Number, required: true },
    lng:          { type: Number, required: true },
    isDefault:    { type: Boolean, default: false },
    zoneId:       { type: Schema.Types.ObjectId },
    instructions: { type: String },
  },
  { _id: true },
);

const MarketingPrefsSchema = new Schema(
  {
    sms:      { type: Boolean, default: true },
    email:    { type: Boolean, default: true },
    push:     { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    tenantId:          { type: Schema.Types.ObjectId, required: true, index: true },
    type:              { type: String, enum: ['customer', 'staff'], required: true, index: true },
    email:             { type: String, sparse: true, lowercase: true, trim: true },
    phone:             { type: PhoneSchema, required: true },
    passwordHash:      { type: String, select: false },
    emailVerified:     { type: Boolean, default: false },
    phoneVerified:     { type: Boolean, default: false },
    fullName: {
      ar: { type: String, trim: true },
      en: { type: String, required: true, trim: true },
    },
    dob:               { type: Date },
    gender:            { type: String, enum: ['M', 'F', 'X'] },
    preferredLanguage: { type: String, enum: ['ar', 'en'], default: 'ar' },

    // staff-only
    role: {
      type: String,
      enum: ['SuperAdmin', 'BranchManager', 'Cashier', 'KitchenStaff', 'Driver', 'Marketing', 'Customer'],
    },
    branchIds:    [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
    employmentId: { type: String, sparse: true },

    // customer-only
    loyaltyAccountId: { type: Schema.Types.ObjectId, ref: 'LoyaltyAccount' },
    addresses:        [AddressSchema],
    marketingPrefs:   MarketingPrefsSchema,

    lastLoginAt: { type: Date },
    mfa: {
      enabled: { type: Boolean, default: false },
      secret:  { type: String, select: false },
    },
    status:  { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

UserSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
UserSchema.index({ tenantId: 1, 'phone.number': 1 }, { unique: true, sparse: true });
UserSchema.index({ tenantId: 1, type: 1, status: 1 });
UserSchema.index({ tenantId: 1, branchIds: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: import('mongoose').Types.ObjectId };

export const UserModel: Model<UserDoc> = model<UserDoc>('User', UserSchema);
