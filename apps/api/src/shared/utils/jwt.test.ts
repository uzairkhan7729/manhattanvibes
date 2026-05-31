import { describe, expect, it } from 'vitest';

import { generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken } from './jwt.js';

describe('jwt', () => {
  it('signs and verifies an access token', async () => {
    const { token, jti } = await signAccessToken({
      userId: '507f1f77bcf86cd799439011',
      role: 'Customer',
      tenantId: '000000000000000000000001',
      branchIds: [],
    });
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe('507f1f77bcf86cd799439011');
    expect(claims.role).toBe('Customer');
    expect(claims.jti).toBe(jti);
  });

  it('rejects tampered token', async () => {
    const { token } = await signAccessToken({
      userId: '507f1f77bcf86cd799439011',
      role: 'Customer',
      tenantId: '000000000000000000000001',
      branchIds: [],
    });
    const bad = token.slice(0, -2) + 'AA';
    await expect(verifyAccessToken(bad)).rejects.toBeDefined();
  });

  it('generates an unguessable refresh token and reproducible hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(hashRefreshToken(a.token)).toBe(a.hash);
  });
});
