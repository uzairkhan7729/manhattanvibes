import type { RequestHandler } from 'express';
import { nanoid } from 'nanoid';

import { env } from '../config/env.js';

const HEADER = 'x-request-id';

/**
 * Assigns a stable request id. Honors a client-provided id only outside production
 * (so prod can't be poisoned with spoofed ids).
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.header(HEADER);
  const id = !env.isProd && incoming ? incoming : nanoid(16);
  req.id = id;
  res.setHeader(HEADER, id);
  next();
};
