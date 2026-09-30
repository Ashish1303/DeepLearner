import type { Request, RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
export interface CookieConfig {
  APP_ENV: string;
  AUTH_COOKIE_SECURE: boolean;
  CORS_ORIGINS: string[];
}
const loopbackHost = (host: string) =>
  ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
export function checkAuthOrigin(req: Request, config: CookieConfig) {
  const origin = req.headers.origin;
  if (!origin || !config.CORS_ORIGINS.includes(origin))
    throw new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed');
  if (!config.AUTH_COOKIE_SECURE) {
    const url = new URL(origin);
    const peer = req.socket.remoteAddress;
    if (
      config.APP_ENV !== 'LOCAL' ||
      !loopbackHost(url.hostname) ||
      url.hostname !== req.hostname ||
      !loopbackHost(req.hostname) ||
      !peer ||
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer)
    )
      throw new AppError(
        403,
        'ORIGIN_NOT_ALLOWED',
        'Local cookie configuration requires loopback',
      );
  }
}
export function authOrigin(config: CookieConfig): RequestHandler {
  return (req, _res, next) => {
    try {
      checkAuthOrigin(req, config);
      next();
    } catch (error) {
      next(error);
    }
  };
}
