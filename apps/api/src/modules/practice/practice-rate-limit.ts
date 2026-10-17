import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
export const practiceLimitDefaults = {
  ip: 300,
  get: 120,
  windowMs: 15 * 60 * 1000,
};
export type PracticeLimits = typeof practiceLimitDefaults;
export function createPracticeRateLimits(
  config: PracticeLimits = practiceLimitDefaults,
) {
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
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
    get: limit(config.get, (req) =>
      obscure(req.auth?.sub ?? 'unauthenticated'),
    ),
  };
}
