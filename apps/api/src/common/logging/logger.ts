import pino from 'pino';
import { env } from '../../config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'deeplearner-api' },
  // Only explicitly selected operational fields are logged by the scaffold.
  redact: ['password', 'token', 'authorization', 'cookie', 'headers', 'body'],
});
