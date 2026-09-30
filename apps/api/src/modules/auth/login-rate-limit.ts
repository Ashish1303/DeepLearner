import { createHmac, randomBytes } from 'node:crypto';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { normalizedEmail } from './auth.schema.js';
import { AppError } from '../../common/errors/app-error.js';
export interface LoginLimits {
  AUTH_LOGIN_LIMIT: number;
  AUTH_LOGIN_WINDOW_MS: number;
  AUTH_LOGIN_IP_LIMIT: number;
  AUTH_LOGIN_IP_WINDOW_MS: number;
  AUTH_REFRESH_LIMIT: number;
  AUTH_REFRESH_WINDOW_MS: number;
}
export function createLoginRateLimits(config: LoginLimits) {
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const ip = (req: Request) => obscure(ipKeyGenerator(req.ip ?? 'unknown', 56));
  const pair = (req: Request) => {
    const email = normalizedEmail.safeParse(req.body?.email);
    return obscure(
      `${ip(req)}:${email.success ? email.data : 'invalid-email'}`,
    );
  };
  const limiter = (
    limit: number,
    windowMs: number,
    keyGenerator = ip,
    skipSuccessfulRequests = false,
  ) =>
    rateLimit({
      limit,
      windowMs,
      keyGenerator,
      skipSuccessfulRequests,
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
    login: [
      limiter(config.AUTH_LOGIN_IP_LIMIT, config.AUTH_LOGIN_IP_WINDOW_MS),
      limiter(config.AUTH_LOGIN_LIMIT, config.AUTH_LOGIN_WINDOW_MS, pair, true),
    ],
    refresh: limiter(config.AUTH_REFRESH_LIMIT, config.AUTH_REFRESH_WINDOW_MS),
  };
}
