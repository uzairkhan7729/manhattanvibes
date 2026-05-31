import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import { Server as IOServer } from 'socket.io';

import { env } from '../config/env.js';

import { logger } from './logger.js';
import { makeRedisPair } from './redis.js';

let io: IOServer | null = null;

export function initSocketIO(httpServer: HttpServer): IOServer {
  if (io) return io;

  io = new IOServer(httpServer, {
    cors: {
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Horizontal scale: Redis pub/sub adapter.
  const { pub, sub } = makeRedisPair();
  io.adapter(createAdapter(pub, sub));

  io.engine.on('connection_error', (err) => {
    logger.warn({ err: { code: err.code, message: err.message } }, 'socket.io connection error');
  });

  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'socket connected');
    socket.on('disconnect', (reason) => {
      logger.debug({ id: socket.id, reason }, 'socket disconnected');
    });
  });

  logger.info('socket.io initialized');
  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export async function closeSocketIO(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => io!.close(() => resolve()));
  io = null;
}
