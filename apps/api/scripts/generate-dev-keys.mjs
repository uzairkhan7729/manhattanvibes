#!/usr/bin/env node
// Generates an RSA-2048 key pair for local-dev JWT signing.
// Writes them as JWT_PRIVATE_KEY / JWT_PUBLIC_KEY into apps/api/.env.local
// (creates the file if missing). Existing keys are not overwritten.

import { generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

const existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
if (existing.includes('JWT_PRIVATE_KEY=') && !existing.match(/^JWT_PRIVATE_KEY=\s*$/m)) {
  console.log('JWT_PRIVATE_KEY already set in apps/api/.env.local — leaving alone.');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const escape = (s) => s.trim().replace(/\n/g, '\\n');

const block = `# auto-generated dev JWT keys (rotate manually)\nJWT_PRIVATE_KEY="${escape(privateKey)}"\nJWT_PUBLIC_KEY="${escape(publicKey)}"\n`;

const newContent = existing.endsWith('\n') || existing.length === 0 ? existing + block : existing + '\n' + block;
writeFileSync(envPath, newContent, 'utf8');
console.log('Wrote dev RSA keys to', envPath);
