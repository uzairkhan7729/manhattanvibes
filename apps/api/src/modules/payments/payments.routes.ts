import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { objectIdSchema } from '@mv/validators';

import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import * as svc from './payments.service.js';

export const paymentsRouter: Router = Router();

const intentSchema = z.object({
  orderId: objectIdSchema,
  method: z.enum(['cash', 'mada', 'visa', 'mastercard', 'applepay', 'stcpay', 'wallet', 'loyalty']),
  amount: z.number().int().min(1).optional(),
  returnUrl: z.string().url().optional(),
});
paymentsRouter.post('/intent', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  const input = intentSchema.parse(req.body);
  res.status(201).json(await svc.createIntent(req.tenantId, input));
}));

paymentsRouter.post('/:id/capture', requireAuth, requirePermission('payments:capture'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    res.json(await svc.capture(req.tenantId, id));
  }));

const refundSchema = z.object({ amount: z.number().int().min(1), reason: z.string().min(1) });
paymentsRouter.post('/:id/refund', requireAuth, requirePermission('orders:refund'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = objectIdSchema.parse(req.params.id);
    const { amount, reason } = refundSchema.parse(req.body);
    res.json(await svc.refund(req.tenantId, id, amount, reason, req.auth?.userId));
  }));

// Webhook — no auth, signature-verified.
const webhookSchema = z.object({
  txnId: z.string(),
  event: z.enum(['authorized', 'captured', 'failed', 'refunded']),
});
paymentsRouter.post('/webhook/:gateway', asyncHandler(async (req: Request, res: Response) => {
  const gateway = String(req.params.gateway ?? 'sandbox');
  const signature = req.header('x-gateway-signature') ?? '';
  const result = await svc.handleWebhook(gateway, signature, JSON.stringify(req.body), webhookSchema.parse(req.body));
  res.status(result.ok ? 200 : 401).json(result);
}));
