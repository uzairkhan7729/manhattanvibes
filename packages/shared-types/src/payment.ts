import type { Id, Iso8601, Halalas, Currency } from './common.js';

export type PaymentMethod =
  | 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay' | 'wallet' | 'loyalty';

export type PaymentStatusInternal =
  | 'authorized' | 'captured' | 'failed' | 'voided' | 'refunded' | 'partial-refunded';

export type PaymentGateway = 'hyperpay' | 'moyasar' | 'checkout' | 'stcpay-native';

export interface PaymentRefund {
  amount: Halalas;
  reason: string;
  refundedAt: Iso8601;
  byUserId: Id;
  gatewayRefundId?: string;
}

export interface Payment {
  _id: Id;
  tenantId: Id;
  branchId: Id;
  orderId: Id;
  method: PaymentMethod;
  amount: Halalas;
  currency: Currency;
  status: PaymentStatusInternal;
  gateway?: PaymentGateway;
  gatewayRefs?: {
    txnId?: string;
    authCode?: string;
    last4?: string;
    brand?: string;
    threeDS?: string;
    raw?: Record<string, unknown>;
  };
  refunds: PaymentRefund[];
  capturedAt?: Iso8601;
  createdAt: Iso8601;
  updatedAt: Iso8601;
}
