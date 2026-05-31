import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { i18nTextSchema, objectIdSchema } from '@mv/validators';

import { optionalAuth, requireAuth } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

import * as svc from './branches.service.js';

export const branchesRouter: Router = Router();

branchesRouter.get('/', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json({ items: await svc.listBranches(req.tenantId) });
}));

branchesRouter.get('/:id', optionalAuth, asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.getBranch(req.tenantId, objectIdSchema.parse(req.params.id)));
}));

const createBranchSchema = z.object({
  code: z.string().min(1),
  name: i18nTextSchema,
  address: z.object({
    label: z.string().optional(),
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    district: z.string().min(1),
    country: z.string().default('SA'),
    lat: z.number(),
    lng: z.number(),
  }),
  contact: z.object({ phone: z.string(), email: z.string().email().optional() }),
  taxId: z.string().min(1),
  zatcaSerialPrefix: z.string().min(1),
  openingHours: z.array(z.object({ day: z.number().int().min(0).max(6), open: z.string(), close: z.string() })).optional(),
  features: z.object({ dineIn: z.boolean().optional(), pickup: z.boolean().optional(), delivery: z.boolean().optional(), takeaway: z.boolean().optional() }).optional(),
});
branchesRouter.post('/', requireAuth, requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const input = createBranchSchema.parse(req.body);
  res.status(201).json(await svc.createBranch(req.tenantId, input as never));
}));

const patchBranchSchema = createBranchSchema.partial().extend({
  status: z.enum(['active', 'paused', 'closed']).optional(),
});
branchesRouter.patch('/:id', requireAuth, requirePermission('branches:write'), asyncHandler(async (req: Request, res: Response) => {
  const id = objectIdSchema.parse(req.params.id);
  const patch = patchBranchSchema.parse(req.body);
  res.json(await svc.updateBranch(req.tenantId, id, patch as never));
}));
