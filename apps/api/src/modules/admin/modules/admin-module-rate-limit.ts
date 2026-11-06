import { createHmac, randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../../common/errors/app-error.js';
import { createAdminLimitStore } from '../admin-rate-limit.js';
import { moduleUnavailable } from './admin-module.dto.js';

export const moduleReadLimitDefaults = {
  read: 120,
  windowMs: 60000,
  capacity: 10000,
};
export type ModuleReadLimits = typeof moduleReadLimitDefaults;
export function createModuleReadLimit(
  config: ModuleReadLimits = moduleReadLimitDefaults,
) {
  if (
    Object.values(config).some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    ) ||
    config.windowMs > 60000 ||
    config.capacity > 10000
  )
    throw moduleUnavailable();
  const secret = randomBytes(32);
  return rateLimit({
    limit: config.read,
    windowMs: config.windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: false,
    store: createAdminLimitStore(config.capacity, config.windowMs),
    keyGenerator(req) {
      if (
        !req.auth ||
        req.auth.role !== 'ADMIN' ||
        !/^[a-f0-9]{24}(?![\s\S])/.test(req.auth.sub)
      )
        throw moduleUnavailable();
      return createHmac('sha256', secret)
        .update('module:' + req.auth.sub)
        .digest('hex');
    },
    handler: (_req, _res, next) =>
      next(
        new AppError(
          429,
          'RATE_LIMIT_EXCEEDED',
          'Too many requests; try again later',
        ),
      ),
  });
}
