import { createHmac, randomBytes } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
export const moduleLimitDefaults = { max: 120, windowMs: 15 * 60 * 1000 };
export function createModuleRateLimit(config = moduleLimitDefaults) {
  const secret = randomBytes(32);
  return rateLimit({
    limit: config.max,
    windowMs: config.windowMs,
    keyGenerator: (req) =>
      createHmac('sha256', secret)
        .update(ipKeyGenerator(req.ip ?? 'unknown', 56))
        .digest('hex'),
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
}
