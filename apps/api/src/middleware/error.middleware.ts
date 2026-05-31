import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../config/env.js';
import { logger } from '../infra/logger.js';
import { HttpError, NotFoundError, RateLimitedError, ValidationError } from '../shared/errors/index.js';

/** Catch-all "no route matched" -> 404. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route'));
};

/**
 * Centralised error → RFC 7807 problem+json response.
 * Stable error codes are part of the public API contract; do not rename casually.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Zod errors → ValidationError shape
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '<root>';
      fields[path] = issue.message;
    }
    err = new ValidationError(fields);
  }

  if (err instanceof HttpError) {
    if (err instanceof RateLimitedError && err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    const body = {
      type: `${env.PUBLIC_BASE_URL}/errors/${err.code}`,
      title: humanTitle(err.code),
      status: err.status,
      detail: err.expose ? err.message : undefined,
      instance: req.originalUrl,
      requestId: req.id,
      fields: err.fields,
    };
    res.status(err.status).type('application/problem+json').json(body);
    return;
  }

  // Unknown — log and respond opaquely.
  logger.error({ err, requestId: req.id, url: req.originalUrl }, 'unhandled error');
  res.status(500).type('application/problem+json').json({
    type: `${env.PUBLIC_BASE_URL}/errors/internal-error`,
    title: 'Internal Server Error',
    status: 500,
    instance: req.originalUrl,
    requestId: req.id,
  });
};

function humanTitle(code: string): string {
  return code
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
