import { createServer } from 'node:http';

import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './infra/logger.js';
import { connectMongo, disconnectMongo } from './infra/mongo.js';
import { disconnectRedis, getRedis } from './infra/redis.js';
import { closeSocketIO, initSocketIO } from './infra/socket.js';

async function main(): Promise<void> {
  logger.info({ env: env.NODE_ENV, version: process.version }, 'mv-api starting');

  // Warm up infra before listening so /health/ready is meaningful from t=0.
  await connectMongo();
  getRedis(); // sync init; errors surface on first command

  const app = createApp();
  const httpServer = createServer(app);
  initSocketIO(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(env.PORT, resolve));
  logger.info({ port: env.PORT }, 'mv-api listening');

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown initiated');
    httpServer.close();
    await closeSocketIO();
    await disconnectMongo();
    await disconnectRedis();
    logger.info('shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    process.exit(1);
  });
}

void main().catch((err: unknown) => {
  // logger may not be initialized; safe fallback
  // eslint-disable-next-line no-console
  console.error('boot failed:', err);
  process.exit(1);
});
