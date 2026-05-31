import type { RequestHandler } from 'express';

import type { Role } from '@mv/shared-types';

import { ForbiddenError, UnauthenticatedError } from '../shared/errors/index.js';

/**
 * Permission matrix. Mirrors docs/03-TDD-TECHNICAL-DESIGN.md §4.2.
 * Strings are `<resource>:<action>`; `*` is a wildcard suffix.
 */
const permissions: Record<Role, string[]> = {
  SuperAdmin: ['*'],
  BranchManager: [
    'orders:*', 'orders:refund',
    'inventory:*',
    'employees:read', 'employees:write',
    'reports:branch', 'reports:write',
    'promotions:read', 'promotions:write', 'campaigns:read', 'campaigns:write',
    'catalog:override-branch',
    'customers:read',
    'branches:write',           // can edit own branch hours/zones
    'payments:capture',
  ],
  Cashier: [
    'orders:create', 'orders:read', 'orders:modify-pre-kitchen', 'orders:state:advance',
    'payments:capture',
    'customers:read', 'customers:write',
  ],
  KitchenStaff: ['orders:read', 'orders:state:advance'],
  Driver: ['orders:read:assigned', 'orders:state:delivered'],
  Marketing: [
    'campaigns:*', 'segments:*', 'customers:read', 'customers:write',
    'promotions:read', 'promotions:write',
  ],
  Customer: ['orders:create', 'orders:read:own', 'profile:*'],
};

function hasPermission(role: Role, required: string): boolean {
  const granted = permissions[role] ?? [];
  if (granted.includes('*')) return true;
  if (granted.includes(required)) return true;
  // wildcard match: `orders:*` allows `orders:anything`
  return granted.some((g) => g.endsWith(':*') && required.startsWith(g.slice(0, -1)));
}

/**
 * Express middleware factory.
 *
 *   router.get('/x', requirePermission('orders:read'), handler)
 */
export function requirePermission(action: string): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new UnauthenticatedError());
    if (!hasPermission(req.auth.role, action)) {
      return next(new ForbiddenError(`Missing permission: ${action}`));
    }
    next();
  };
}

/**
 * Enforces that a branch-scoped request targets a branch the actor is allowed to.
 * SuperAdmin & roles with empty branchIds are unrestricted.
 *
 *   router.post('/x', requireAuth, requireBranchScope(req => req.body.branchId), handler)
 */
export function requireBranchScope(extract: (req: import('express').Request) => string | undefined): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(new UnauthenticatedError());
    if (req.auth.role === 'SuperAdmin') return next();
    const target = extract(req);
    if (!target) return next();
    if (req.auth.branchIds.length === 0) return next(); // not scoped → allow (e.g., customer)
    if (!req.auth.branchIds.includes(target)) {
      return next(new ForbiddenError('Branch out of scope'));
    }
    next();
  };
}
