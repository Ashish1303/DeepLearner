import { createHmac, randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
import { normalizedEmail } from './auth.schema.js';

export interface RecoveryLimits {
  AUTH_FORGOT_LIMIT: number;
  AUTH_FORGOT_WINDOW_MS: number;
  AUTH_RESET_LIMIT: number;
  AUTH_RESET_WINDOW_MS: number;
  AUTH_CHANGE_LIMIT: number;
  AUTH_CHANGE_WINDOW_MS: number;
  AUTH_CHANGE_IP_LIMIT: number;
  AUTH_CHANGE_IP_WINDOW_MS: number;
}
export function createRecoveryRateLimits(config: RecoveryLimits) {
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const ip = (req: Request) => obscure(ipKeyGenerator(req.ip ?? 'unknown', 56));
  const email = (req: Request) => {
    const parsed = normalizedEmail.safeParse(req.body?.email);
    return obscure(parsed.success ? parsed.data : 'invalid-email');
  };
  const user = (req: Request) => obscure(req.auth?.sub ?? 'unauthenticated');
  const limit = (
    max: number,
    windowMs: number,
    keyGenerator: (req: Request) => string,
  ) =>
    rateLimit({
      limit: max,
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
    forgot: [
      limit(config.AUTH_FORGOT_LIMIT, config.AUTH_FORGOT_WINDOW_MS, ip),
      limit(config.AUTH_FORGOT_LIMIT, config.AUTH_FORGOT_WINDOW_MS, email),
    ],
    reset: limit(config.AUTH_RESET_LIMIT, config.AUTH_RESET_WINDOW_MS, ip),
    changeIp: limit(
      config.AUTH_CHANGE_IP_LIMIT,
      config.AUTH_CHANGE_IP_WINDOW_MS,
      ip,
    ),
    changeUser: limit(
      config.AUTH_CHANGE_LIMIT,
      config.AUTH_CHANGE_WINDOW_MS,
      user,
    ),
  };
}
