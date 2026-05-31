import mongoose from 'mongoose';

import { env } from '../config/env.js';

import { logger } from './logger.js';

let connected = false;

export async function connectMongo(): Promise<void> {
  if (connected) return;
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
  mongoose.connection.on('error', (err: unknown) => logger.error({ err }, 'mongo error'));

  await mongoose.connect(env.MONGO_URI, {
    maxPoolSize: env.MONGO_MAX_POOL,
    serverSelectionTimeoutMS: 5_000,
    autoIndex: !env.isProd, // in prod, indexes are managed by migrations
  });

  connected = true;
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

export function mongoHealth(): { ok: boolean; state: number } {
  // 0=disconnected,1=connected,2=connecting,3=disconnecting
  return { ok: mongoose.connection.readyState === 1, state: mongoose.connection.readyState };
}
