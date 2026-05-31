import { randomUUID } from 'node:crypto';

import type { GatewayCaptureResult, GatewayCreateIntentInput, GatewayCreateIntentResult, GatewayRefundResult, PaymentGateway } from './gateway.interface.js';

/**
 * Sandbox gateway — always succeeds. Used in dev / staging / tests.
 * Real adapters (HyperPay, Moyasar, STC Pay) will land in Phase 6
 * and implement the same interface.
 */
export const sandboxGateway: PaymentGateway = {
  name: 'sandbox',

  async createIntent(input: GatewayCreateIntentInput): Promise<GatewayCreateIntentResult> {
    return {
      externalId: `sbx_${randomUUID()}`,
      redirectUrl: `${input.returnUrl}?status=approved&orderRef=${encodeURIComponent(input.orderRef)}`,
      raw: { sandbox: true, amount: input.amount },
    };
  },

  async capture(externalId: string): Promise<GatewayCaptureResult> {
    return {
      ok: true,
      txnId: externalId,
      authCode: 'SBX-AUTH',
      last4: '4242',
      brand: 'SANDBOX',
      raw: { sandbox: true },
    };
  },

  async refund(_externalId: string, _amount: number, _reason: string): Promise<GatewayRefundResult> {
    return { ok: true, refundId: `sbx_refund_${randomUUID()}` };
  },

  verifyWebhook(_signature: string, _rawBody: string): boolean {
    return true;
  },
};
