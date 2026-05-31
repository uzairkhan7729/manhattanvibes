import { createAdapter } from '@socket.io/redis-adapter';
import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, type Namespace, type Socket } from 'socket.io';

import { env } from '../config/env.js';

import { logger } from './logger.js';
import { makeRedisPair } from './redis.js';

let io: IOServer | null = null;

/**
 * Permissive Socket.IO CORS in dev (matches HTTP CORS) so any localhost:* origin
 * works. Production falls back to the strict env list.
 */
function socketCorsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void {
  if (!origin) return cb(null, true);
  if (env.isDev && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
  if (env.isDev && /^app:\/\//.test(origin)) return cb(null, true);
  if (env.corsOrigins.includes(origin)) return cb(null, true);
  cb(new Error(`socket.io CORS denied: ${origin}`));
}

export function initSocketIO(httpServer: HttpServer): IOServer {
  if (io) return io;

  io = new IOServer(httpServer, {
    cors: { origin: socketCorsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  const { pub, sub } = makeRedisPair();
  io.adapter(createAdapter(pub, sub));

  io.engine.on('connection_error', (err) => {
    logger.warn({ err: { code: err.code, message: err.message } }, 'socket.io connection error');
  });

  // Generic logger on the root namespace (helpful for unscoped clients in dev).
  io.on('connection', (socket) => {
    logger.debug({ id: socket.id, ns: '/' }, 'socket connected');
    socket.on('disconnect', (reason) => logger.debug({ id: socket.id, ns: '/', reason }, 'socket disconnected'));
  });

  // ── Per-namespace handlers ────────────────────────────────────────────
  registerJoinHandler(io.of('/tracking'), (socket, payload) => {
    // Clients tracking an order: payload = { orderId }
    const orderId = typeof payload?.orderId === 'string' ? payload.orderId : null;
    if (orderId) {
      void socket.join(`order:${orderId}`);
      logger.debug({ id: socket.id, room: `order:${orderId}` }, '/tracking joined');
    }
  });

  registerJoinHandler(io.of('/kds'), (socket, payload) => {
    // KDS terminals: payload = { branchId, station? }
    const branchId = typeof payload?.branchId === 'string' ? payload.branchId : null;
    if (branchId) {
      void socket.join(`branch:${branchId}:kitchen`);
      logger.debug({ id: socket.id, room: `branch:${branchId}:kitchen` }, '/kds joined');
    }
  });

  registerJoinHandler(io.of('/admin'), (socket, payload) => {
    // Admin live views: payload = { branchId } (omit for cross-branch)
    const branchId = typeof payload?.branchId === 'string' ? payload.branchId : null;
    if (branchId) {
      void socket.join(`branch:${branchId}:admin`);
      logger.debug({ id: socket.id, room: `branch:${branchId}:admin` }, '/admin joined');
    }
  });

  registerJoinHandler(io.of('/driver'), (socket, payload) => {
    // Driver app: payload = { driverId }
    const driverId = typeof payload?.driverId === 'string' ? payload.driverId : null;
    if (driverId) {
      void socket.join(`driver:${driverId}`);
      logger.debug({ id: socket.id, room: `driver:${driverId}` }, '/driver joined');
    }
  });

  logger.info('socket.io initialized');
  return io;
}

/**
 * Wire a connect+join handler on a namespace. The client emits
 * socket.emit('join', { ... }) and the server routes them to the right room.
 */
function registerJoinHandler(ns: Namespace, onJoin: (socket: Socket, payload: Record<string, unknown>) => void): void {
  ns.on('connection', (socket) => {
    logger.debug({ id: socket.id, ns: ns.name }, 'socket connected');
    socket.on('join', (payload: Record<string, unknown>) => {
      try { onJoin(socket, payload ?? {}); }
      catch (e: unknown) { logger.warn({ err: e, ns: ns.name }, 'join handler failed'); }
    });
    socket.on('disconnect', (reason) => logger.debug({ id: socket.id, ns: ns.name, reason }, 'socket disconnected'));
  });
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
