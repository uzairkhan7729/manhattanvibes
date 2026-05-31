import type { Halalas } from '../../../shared/utils/halalas.js';

export interface GatewayCreateIntentInput {
  amount: Halalas;
  currency: 'SAR';
  orderRef: string;        // our order number
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface GatewayCreateIntentResult {
  externalId: string;
  redirectUrl?: string;
  raw?: Record<string, unknown>;
}

export interface GatewayCaptureResult {
  ok: boolean;
  txnId: string;
  authCode?: string;
  last4?: string;
  brand?: string;
  raw?: Record<string, unknown>;
}

export interface GatewayRefundResult {
  ok: boolean;
  refundId: string;
  raw?: Record<string, unknown>;
}

export interface PaymentGateway {
  readonly name: 'hyperpay' | 'moyasar' | 'checkout' | 'stcpay-native' | 'cash' | 'sandbox';
  createIntent(input: GatewayCreateIntentInput): Promise<GatewayCreateIntentResult>;
  capture(externalId: string): Promise<GatewayCaptureResult>;
  refund(externalId: string, amount: Halalas, reason: string): Promise<GatewayRefundResult>;
  verifyWebhook(signature: string, rawBody: string): boolean;
}
