import { Types } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/index.js';
import type { Halalas } from '../../shared/utils/halalas.js';
import { OrderModel } from '../orders/order.model.js';
import * as orders from '../orders/orders.service.js';

import { cashGateway } from './gateways/cash.gateway.js';
import type { PaymentGateway } from './gateways/gateway.interface.js';
import { sandboxGateway } from './gateways/sandbox.gateway.js';
import { PaymentModel, type PaymentDoc } from './payment.model.js';

const tid = (s: string): Types.ObjectId => new Types.ObjectId(s);

type Method = 'cash' | 'mada' | 'visa' | 'mastercard' | 'applepay' | 'stcpay' | 'wallet' | 'loyalty';

function selectGateway(method: Method): PaymentGateway {
  if (method === 'cash') return cashGateway;
  // Phase 1: route all electronic methods through the sandbox.
  // Phase 6 wires HyperPay/Moyasar/STC Pay adapters here based on (method, branch, feature flag).
  return sandboxGateway;
}

export interface CreateIntentInput {
  orderId: string;
  method: Method;
  amount?: Halalas;
  returnUrl?: string;
}

export async function createIntent(tenantId: string, input: CreateIntentInput): Promise<{ paymentId: string; redirectUrl?: string; externalId: string }> {
  const order = await OrderModel.findOne({ _id: tid(input.orderId), tenantId: tid(tenantId) }).exec();
  if (!order) throw new NotFoundError('Order');

  const amount = input.amount ?? order.pricing?.total ?? 0;
  if (amount <= 0) throw new ValidationError({ amount: 'must be > 0' });

  const gw = selectGateway(input.method);
  const intent = await gw.createIntent({
    amount,
    currency: 'PKR',
    orderRef: order.orderNumber,
    returnUrl: input.returnUrl ?? 'https://manhattanvibes.pk/return',
  });

  const payment = await PaymentModel.create({
    tenantId: tid(tenantId),
    branchId: order.branchId,
    orderId: order._id,
    method: input.method,
    amount,
    currency: 'PKR',
    status: 'authorized',
    gateway: gw.name,
    gatewayRefs: { txnId: intent.externalId, raw: intent.raw },
  });

  return { paymentId: payment._id.toString(), redirectUrl: intent.redirectUrl, externalId: intent.externalId };
}

export async function capture(tenantId: string, paymentId: string): Promise<PaymentDoc> {
  const payment = await PaymentModel.findOne({ _id: tid(paymentId), tenantId: tid(tenantId) }).exec();
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status === 'captured') return payment;
  if (payment.status !== 'authorized') throw new ConflictError('payment-state', `Cannot capture from ${payment.status}`);

  const gw = selectGateway(payment.method as Method);
  const result = await gw.capture(payment.gatewayRefs?.txnId ?? '');
  if (!result.ok) {
    payment.status = 'failed';
    await payment.save();
    throw new ConflictError('payment-declined', 'Gateway declined capture');
  }
  payment.status = 'captured';
  payment.capturedAt = new Date();
  if (payment.gatewayRefs) {
    payment.gatewayRefs.authCode = result.authCode;
    payment.gatewayRefs.last4 = result.last4;
    payment.gatewayRefs.brand = result.brand;
  }
  await payment.save();

  // Mark order paid (or partial) and advance to CONFIRMED.
  const order = await OrderModel.findById(payment.orderId).exec();
  if (order) {
    const allPayments = await PaymentModel.find({ orderId: order._id, status: 'captured' }).exec();
    const paid = allPayments.reduce((s, p) => s + p.amount, 0);
    const required = order.pricing?.total ?? 0;
    order.paymentStatus = paid >= required ? 'paid' : 'partial';
    if (!order.payments?.some((p) => p.equals(payment._id))) order.payments?.push(payment._id);
    await order.save();

    if (order.paymentStatus === 'paid' && order.state === 'CREATED') {
      await orders.transition(tenantId, order._id.toString(), 'CONFIRMED', {});
    }
  }
  return payment;
}

export async function refund(tenantId: string, paymentId: string, amount: Halalas, reason: string, byUserId?: string): Promise<PaymentDoc> {
  const payment = await PaymentModel.findOne({ _id: tid(paymentId), tenantId: tid(tenantId) }).exec();
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'captured' && payment.status !== 'partial-refunded') {
    throw new ConflictError('payment-state', `Cannot refund from ${payment.status}`);
  }
  const alreadyRefunded = payment.refunds?.reduce((s, r) => s + r.amount, 0) ?? 0;
  if (alreadyRefunded + amount > payment.amount) throw new ValidationError({ amount: 'exceeds capturable balance' });

  const gw = selectGateway(payment.method as Method);
  const result = await gw.refund(payment.gatewayRefs?.txnId ?? '', amount, reason);
  if (!result.ok) throw new ConflictError('payment-refund-failed', 'Gateway refused refund');

  payment.refunds?.push({ amount, reason, refundedAt: new Date(), byUserId: byUserId ? tid(byUserId) : undefined, gatewayRefundId: result.refundId });
  const newRefunded = alreadyRefunded + amount;
  payment.status = newRefunded >= payment.amount ? 'refunded' : 'partial-refunded';
  await payment.save();
  return payment;
}

/** Webhook handler — verifies & advances payment. */
export async function handleWebhook(gatewayName: string, signature: string, rawBody: string, parsed: { txnId: string; event: 'authorized' | 'captured' | 'failed' | 'refunded' }): Promise<{ ok: boolean }> {
  const gw = gatewayName === 'cash' ? cashGateway : sandboxGateway; // expand with real adapters
  if (!gw.verifyWebhook(signature, rawBody)) return { ok: false };

  const payment = await PaymentModel.findOne({ 'gatewayRefs.txnId': parsed.txnId }).exec();
  if (!payment) return { ok: false };

  if (parsed.event === 'captured' && payment.status !== 'captured') {
    payment.status = 'captured';
    payment.capturedAt = new Date();
  } else if (parsed.event === 'failed') {
    payment.status = 'failed';
  } else if (parsed.event === 'refunded') {
    payment.status = 'refunded';
  }
  await payment.save();
  return { ok: true };
}
