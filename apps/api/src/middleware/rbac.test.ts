import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { ForbiddenError, UnauthenticatedError } from '../shared/errors/index.js';

import { requirePermission } from './rbac.middleware.js';

function mockReq(role?: string): Request {
  // minimum surface the middleware reads from
  return ({ auth: role ? { role, userId: 'u', tenantId: 't', branchIds: [], claims: {} as never } : undefined } as unknown) as Request;
}

describe('requirePermission', () => {
  it('passes when SuperAdmin', () => {
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('anything:goes')(mockReq('SuperAdmin'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes when explicit permission present', () => {
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('orders:create')(mockReq('Cashier'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes on wildcard match', () => {
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('inventory:adjust')(mockReq('BranchManager'), {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('denies when missing permission', () => {
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('orders:refund')(mockReq('KitchenStaff'), {} as Response, next);
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBeInstanceOf(ForbiddenError);
  });

  it('demands authentication', () => {
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('orders:read')(mockReq(undefined), {} as Response, next);
    expect((next as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBeInstanceOf(UnauthenticatedError);
  });
});
