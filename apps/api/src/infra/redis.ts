import { Redis } from 'ioredis';

import { env } from '../config/env.js';

import { logger } from './logger.js';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,    // required by BullMQ; allows commands to queue while reconnecting
    enableReadyCheck: true,
    lazyConnect: false,
  });
  c.on('connect', () => logger.info('redis connected'));
  c.on('error', (err) => logger.error({ err }, 'redis error'));
  c.on('end', () => logger.warn('redis connection ended'));
  client = c;
  return c;
}

/** A second connection — Socket.IO redis adapter requires duplicated pub/sub clients. */
export function makeRedisPair(): { pub: Redis; sub: Redis } {
  const base = getRedis();
  return { pub: base.duplicate(), sub: base.duplicate() };
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  await client.quit().catch(() => undefined);
  client = null;
}

export async function redisHealth(): Promise<{ ok: boolean }> {
  try {
    const pong = await getRedis().ping();
    return { ok: pong === 'PONG' };
  } catch {
    return { ok: false };
  }
}
