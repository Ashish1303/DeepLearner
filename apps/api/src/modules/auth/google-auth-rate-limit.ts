import { createHmac, randomBytes } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
export interface GoogleLimits {
  AUTH_GOOGLE_LIMIT: number;
  AUTH_GOOGLE_WINDOW_MS: number;
}
export function createGoogleRateLimit(config: GoogleLimits) {
  const secret = randomBytes(32);
  return rateLimit({
    limit: config.AUTH_GOOGLE_LIMIT,
    windowMs: config.AUTH_GOOGLE_WINDOW_MS,
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
