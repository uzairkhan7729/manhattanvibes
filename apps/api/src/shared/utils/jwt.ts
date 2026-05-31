import { createHash, randomUUID } from 'node:crypto';

import type { JwtClaims, Role } from '@mv/shared-types';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type KeyLike } from 'jose';

import { env } from '../../config/env.js';

let privateKey: KeyLike | null = null;
let publicKey: KeyLike | null = null;

async function getKeys(): Promise<{ privateKey: KeyLike; publicKey: KeyLike }> {
  if (!privateKey) privateKey = await importPKCS8(env.jwtPrivateKey, 'RS256');
  if (!publicKey) publicKey = await importSPKI(env.jwtPublicKey, 'RS256');
  return { privateKey, publicKey };
}

export interface SignAccessTokenInput {
  userId: string;
  role: Role;
  tenantId: string;
  branchIds: string[];
  /** Optional pre-allocated jti — used to associate access with refresh family. */
  jti?: string;
}

export async function signAccessToken(input: SignAccessTokenInput): Promise<{ token: string; jti: string; expiresIn: number }> {
  const { privateKey } = await getKeys();
  const jti = input.jti ?? randomUUID();
  const token = await new SignJWT({
    role: input.role,
    branchIds: input.branchIds,
    tenantId: input.tenantId,
  })
    .setProtectedHeader({ alg: 'RS256', kid: env.JWT_KID, typ: 'JWT' })
    .setSubject(input.userId)
    .setJti(jti)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(privateKey);
  return { token, jti, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export async function verifyAccessToken(token: string): Promise<JwtClaims> {
  const { publicKey } = await getKeys();
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    algorithms: ['RS256'],
  });

  if (typeof payload.sub !== 'string') throw new Error('jwt missing sub');
  if (typeof payload.jti !== 'string') throw new Error('jwt missing jti');
  if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') throw new Error('jwt missing iat/exp');
  if (typeof payload.tenantId !== 'string') throw new Error('jwt missing tenantId');
  if (typeof payload.role !== 'string') throw new Error('jwt missing role');

  return {
    sub: payload.sub,
    role: payload.role as Role,
    tenantId: payload.tenantId,
    branchIds: Array.isArray(payload.branchIds) ? (payload.branchIds as string[]) : [],
    jti: payload.jti,
    iat: payload.iat,
    exp: payload.exp,
  };
}

/** Refresh token = opaque, high-entropy string. Stored hashed at rest. */
export function generateRefreshToken(): { token: string; hash: string } {
  // 256 bits of entropy in base64url
  const buf = new Uint8Array(32);
  globalThis.crypto.getRandomValues(buf);
  const token = Buffer.from(buf).toString('base64url');
  const hash = hashRefreshToken(token);
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
