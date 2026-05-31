import { pino } from 'pino';

import { env } from '../config/env.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.cardNumber',
  'req.body.cvv',
  'req.body.otp',
  'req.body.code',
  'req.body.refreshToken',
  'req.body.token',
  '*.password',
  '*.passwordHash',
  '*.refreshToken',
  '*.otp',
  '*.code',
];

export const logger = pino({
  name: env.SERVICE_NAME,
  level: env.LOG_LEVEL,
  base: { service: env.SERVICE_NAME, env: env.NODE_ENV },
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: env.isDev
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', singleLine: false },
      }
    : undefined,
});

export type Logger = typeof logger;
