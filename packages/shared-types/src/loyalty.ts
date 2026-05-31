import type { Id, Iso8601 } from './common.js';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type LedgerEntryType = 'earn' | 'redeem' | 'expire' | 'adjust' | 'birthday' | 'referral';

export interface LoyaltyAccount {
  _id: Id;
  tenantId: Id;
  customerId: Id;
  tier: LoyaltyTier;
  pointsBalance: number;
  lifetimeSpendHalalas: number;
  tierUpgradedAt?: Iso8601;
  tierExpiresAt?: Iso8601;
  status: 'active' | 'frozen';
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface LoyaltyLedgerEntry {
  _id: Id;
  tenantId: Id;
  customerId: Id;
  accountId: Id;
  type: LedgerEntryType;
  points: number;     // signed
  orderId?: Id;
  campaignId?: Id;
  ref?: string;
  ts: Iso8601;
  byUserId?: Id;
}
