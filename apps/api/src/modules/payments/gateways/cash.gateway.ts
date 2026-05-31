import { randomUUID } from 'node:crypto';

import type { GatewayCaptureResult, GatewayRefundResult, PaymentGateway } from './gateway.interface.js';

/**
 * Cash "gateway" — no external system, captures are synchronous.
 */
export const cashGateway: PaymentGateway = {
  name: 'cash',
  async createIntent() {
    return { externalId: `cash_${randomUUID()}` };
  },
  async capture(externalId: string): Promise<GatewayCaptureResult> {
    return { ok: true, txnId: externalId };
  },
  async refund(_id: string, _amount: number, _reason: string): Promise<GatewayRefundResult> {
    return { ok: true, refundId: `cash_refund_${randomUUID()}` };
  },
  verifyWebhook() { return true; },
};
