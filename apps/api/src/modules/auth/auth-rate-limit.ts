import { createHmac, randomBytes } from 'node:crypto';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { normalizedEmail } from './auth.schema.js';

export interface AuthLimits {
  AUTH_REGISTER_LIMIT: number;
  AUTH_REGISTER_WINDOW_MS: number;
  AUTH_VERIFY_LIMIT: number;
  AUTH_VERIFY_WINDOW_MS: number;
  AUTH_RESEND_LIMIT: number;
  AUTH_RESEND_WINDOW_MS: number;
}
export function createAuthRateLimits(config: AuthLimits) {
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const ip = (req: Request) => obscure(ipKeyGenerator(req.ip ?? 'unknown', 56));
  const email = (req: Request) => {
    const parsed = normalizedEmail.safeParse(req.body?.email);
    return obscure(parsed.success ? parsed.data : 'invalid-email');
  };
  const limiter = (limit: number, windowMs: number, keyGenerator = ip) =>
    rateLimit({
      limit,
      windowMs,
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
    register: limiter(
      config.AUTH_REGISTER_LIMIT,
      config.AUTH_REGISTER_WINDOW_MS,
    ),
    verify: limiter(config.AUTH_VERIFY_LIMIT, config.AUTH_VERIFY_WINDOW_MS),
    // Independent budgets are stronger than a pair-only key: changing email or IP
    // cannot reset the other budget. Both inherit the approved resend threshold.
    resend: [
      limiter(config.AUTH_RESEND_LIMIT, config.AUTH_RESEND_WINDOW_MS),
      limiter(config.AUTH_RESEND_LIMIT, config.AUTH_RESEND_WINDOW_MS, email),
    ],
  };
}
