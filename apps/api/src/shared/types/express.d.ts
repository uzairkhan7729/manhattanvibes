import type { JwtClaims, Role } from '@mv/shared-types';

declare global {
  namespace Express {
    interface Request {
      /** Unique per request — set by request-id middleware. */
      id: string;
      /** Present after auth middleware runs on a protected route. */
      auth?: {
        userId: string;
        role: Role;
        tenantId: string;
        branchIds: string[];
        claims: JwtClaims;
      };
      /** Tenant resolved per request (defaults to env.DEFAULT_TENANT_ID). */
      tenantId: string;
    }
  }
}

export {};
