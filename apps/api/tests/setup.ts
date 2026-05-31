// Vitest setup file — runs before each test file.
// Tests that require Mongo/Redis should boot Testcontainers themselves;
// this file only handles environment defaults so unit-test isolation is preserved.

import { generateKeyPairSync } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID ?? '000000000000000000000001';
process.env.MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/mv_test?replicaSet=rs0&directConnection=true';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

if (!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;
}
process.env.OTP_DEV_MODE = 'true';
process.env.LOG_LEVEL = 'error';
