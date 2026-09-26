import pino from 'pino';
import { env } from '../../config/env.js';

// Defense in depth for accidental root/one-level structured fields. Callers
// must still select safe operational data and use fixed log messages.
const sensitiveFields = [
  'password',
  'passwordHash',
  'currentPassword',
  'newPassword',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'refreshTokenHash',
  'credential',
  'credentials',
  'secret',
  'clientSecret',
  'apiKey',
  'authorization',
  'cookie',
  'cookies',
  'headers',
  'body',
  'req',
  'res',
  'request',
  'response',
  'err',
  'error',
  'env',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'deeplearner-api' },
  redact: {
    paths: sensitiveFields.flatMap((field) => [field, `*.${field}`]),
    remove: true,
  },
});
