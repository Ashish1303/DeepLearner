import { createHmac, randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../../common/errors/app-error.js';
import { createAdminLimitStore } from '../admin-rate-limit.js';
import { technologyUnavailable } from './admin-technology.dto.js';

export const technologyLimitDefaults = {
  read: 120,
  mutation: 60,
  windowMs: 60000,
  capacity: 10000,
};
export type TechnologyLimits = typeof technologyLimitDefaults;
export function createTechnologyManagementLimits(
  config: TechnologyLimits = technologyLimitDefaults,
) {
  if (
    Object.values(config).some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    ) ||
    config.capacity > 10000 ||
    config.windowMs > 60000
  )
    throw technologyUnavailable();
  const secret = randomBytes(32);
  const make = (limit: number) =>
    rateLimit({
      limit,
      windowMs: config.windowMs,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      passOnStoreError: false,
      store: createAdminLimitStore(config.capacity, config.windowMs),
      keyGenerator(req) {
        if (
          !req.auth ||
          req.auth.role !== 'ADMIN' ||
          !/^[a-f0-9]{24}$/.test(req.auth.sub)
        )
          throw technologyUnavailable();
        return createHmac('sha256', secret)
          .update('technology:' + req.auth.sub)
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
  return { read: make(config.read), mutation: make(config.mutation) };
}
