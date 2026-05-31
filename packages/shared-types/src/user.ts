import type { Id, Iso8601, I18nText, Phone, Locale } from './common.js';
import type { Role } from './auth.js';

export type UserType = 'customer' | 'staff';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type Gender = 'M' | 'F' | 'X';

export interface Address {
  _id?: Id;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  district: string;
  country: 'SA';
  lat: number;
  lng: number;
  isDefault: boolean;
  zoneId?: Id;
  instructions?: string;
}

export interface MarketingPrefs {
  sms: boolean;
  email: boolean;
  push: boolean;
  whatsapp: boolean;
}

export interface User {
  _id: Id;
  tenantId: Id;
  type: UserType;
  email?: string;
  phone: Phone;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: I18nText;
  dob?: Iso8601;
  gender?: Gender;
  preferredLanguage: Locale;
  role?: Role;
  branchIds?: Id[];
  employmentId?: string;
  loyaltyAccountId?: Id;
  addresses?: Address[];
  marketingPrefs?: MarketingPrefs;
  lastLoginAt?: Iso8601;
  status: UserStatus;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}
