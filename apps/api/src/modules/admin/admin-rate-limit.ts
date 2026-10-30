import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
import { adminUnavailable } from './admin-access.repository.js';

export const adminLimitDefaults = {
  ip: 300,
  account: 120,
  windowMs: 15 * 60 * 1000,
  capacity: 10000,
};
export type AdminLimits = typeof adminLimitDefaults;

/** Bounded process-local storage; never evict a live limit to admit a new key. */
export function createAdminLimitStore(
  capacity: number,
  windowMs: number,
  clock = Date.now,
): Store {
  const entries = new Map<string, { hits: number; expires: number }>();
  return {
    localKeys: true,
    increment(key) {
      const now = clock();
      if (!Number.isFinite(now)) throw adminUnavailable();
      let value = entries.get(key);
      if (value && value.expires <= now) {
        entries.delete(key);
        value = undefined;
      }
      if (!value) {
        if (entries.size >= capacity) {
          for (const [id, entry] of entries)
            if (entry.expires <= now) entries.delete(id);
        }
        if (entries.size >= capacity) throw adminUnavailable();
        value = { hits: 0, expires: now + windowMs };
        entries.set(key, value);
      }
      value.hits = Math.min(value.hits + 1, Number.MAX_SAFE_INTEGER);
      return { totalHits: value.hits, resetTime: new Date(value.expires) };
    },
    decrement(key) {
      const value = entries.get(key);
      if (value) value.hits = Math.max(0, value.hits - 1);
    },
    resetKey(key) {
      entries.delete(key);
    },
  };
}

export function createAdminRateLimits(
  config: AdminLimits = adminLimitDefaults,
) {
  if (
    Object.values(config).some((n) => !Number.isSafeInteger(n) || n < 1) ||
    config.capacity > adminLimitDefaults.capacity ||
    config.windowMs > adminLimitDefaults.windowMs
  )
    throw adminUnavailable();
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const make = (max: number, keyGenerator: (req: Request) => string) =>
    rateLimit({
      limit: max,
      windowMs: config.windowMs,
      keyGenerator,
      store: createAdminLimitStore(config.capacity, config.windowMs),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      passOnStoreError: false,
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
    ip: make(config.ip, (req) => {
      if (!req.ip || !isIP(req.ip)) throw adminUnavailable();
      return obscure('ip:' + ipKeyGenerator(req.ip, 56));
    }),
    account: make(config.account, (req) => {
      if (!req.auth || !/^[a-f0-9]{24}$/.test(req.auth.sub))
        throw adminUnavailable();
      return obscure('account:' + req.auth.sub);
    }),
  };
}
