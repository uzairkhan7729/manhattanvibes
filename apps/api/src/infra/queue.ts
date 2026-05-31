import { Queue, type QueueOptions } from 'bullmq';

import { env } from '../config/env.js';

/**
 * Lazy queue factory. Callers (modules) register their own queues by name;
 * workers live alongside the queue declaration.
 *
 * Conventions:
 *   - queue name = `mv:<module>:<purpose>` (e.g. `mv:notifications:push`)
 *   - default jobs: 3 attempts, exponential backoff starting at 5s
 *   - removeOnComplete after 24h, removeOnFail after 7d for observability
 *
 * NOTE: we pass a fresh connection-options object (parsed from REDIS_URL) rather
 * than reusing the ioredis instance from `infra/redis.ts`. BullMQ ships its own
 * nested `ioredis` whose type definitions are not nominally compatible with the
 * top-level one — passing the URL avoids the type clash and lets BullMQ own its
 * connection lifecycle (which is required for blocking commands anyway).
 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string; username?: string; db?: number } {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 6379,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    username: u.username ? decodeURIComponent(u.username) : undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
  };
}

export function makeQueue<T = unknown>(name: string, overrides?: QueueOptions): Queue<T> {
  return new Queue<T>(name, {
    connection: { ...parseRedisUrl(env.REDIS_URL), maxRetriesPerRequest: null },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { age: 60 * 60 * 24, count: 1_000 },
      removeOnFail: { age: 60 * 60 * 24 * 7 },
    },
    ...overrides,
  });
}
