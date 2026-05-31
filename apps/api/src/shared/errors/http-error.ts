/**
 * Base class for errors that map to an RFC 7807 problem+json response.
 * Subclass per domain reason; the middleware translates them to HTTP.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;     // stable machine-readable code (kebab-case)
  readonly fields?: Record<string, string>;
  readonly expose: boolean;  // include detail in response?

  constructor(opts: {
    status: number;
    code: string;
    message: string;
    fields?: Record<string, string>;
    expose?: boolean;
  }) {
    super(opts.message);
    this.name = this.constructor.name;
    this.status = opts.status;
    this.code = opts.code;
    this.fields = opts.fields;
    this.expose = opts.expose ?? opts.status < 500;
  }
}

export class ValidationError extends HttpError {
  constructor(fields: Record<string, string>, message = 'Validation failed') {
    super({ status: 400, code: 'validation-error', message, fields });
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = 'Authentication required') {
    super({ status: 401, code: 'unauthenticated', message });
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden') {
    super({ status: 403, code: 'forbidden', message });
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = 'Resource') {
    super({ status: 404, code: 'not-found', message: `${resource} not found` });
  }
}

export class ConflictError extends HttpError {
  constructor(code: string, message: string) {
    super({ status: 409, code, message });
  }
}

export class RateLimitedError extends HttpError {
  readonly retryAfterSeconds?: number;
  constructor(retryAfterSeconds?: number, message = 'Too many requests') {
    super({ status: 429, code: 'rate-limited', message });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UpgradeRequiredError extends HttpError {
  constructor(message = 'Client version unsupported — please upgrade') {
    super({ status: 426, code: 'upgrade-required', message });
  }
}
