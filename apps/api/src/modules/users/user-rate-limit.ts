import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
export const userLimitDefaults = {
  get: 120,
  patch: 30,
  ip: 300,
  windowMs: 15 * 60 * 1000,
};
export type UserLimits = typeof userLimitDefaults;
export function createUserRateLimits(config: UserLimits = userLimitDefaults) {
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const user = (req: Request) => obscure(req.auth?.sub ?? 'unauthenticated');
  const limit = (max: number, keyGenerator: (req: Request) => string) =>
    rateLimit({
      limit: max,
      windowMs: config.windowMs,
      keyGenerator,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new AppError(
            429,
            'RATE_LIMIT_EXCEEDED',
            'Too many requests; try again later',
          ),
        ),
    });
  return {
    ip: limit(config.ip, (req) =>
      obscure(ipKeyGenerator(req.ip ?? 'unknown', 56)),
    ),
    get: limit(config.get, user),
    patch: limit(config.patch, user),
  };
}
