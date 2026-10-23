import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import { AppError } from '../../common/errors/app-error.js';
import { dashboardUnavailable } from './dashboard.repository.js';

export const dashboardLimitDefaults = {
  ip: 100,
  student: 20,
  windowMs: 15 * 60 * 1000,
  capacity: 10000,
};
export type DashboardLimits = typeof dashboardLimitDefaults;

/** LOCAL only. Never evict a live counter to admit another identity. */
export function createDashboardLimitStore(
  capacity: number,
  windowMs: number,
  clock = Date.now,
): Store {
  const entries = new Map<string, { totalHits: number; expires: number }>();
  return {
    localKeys: true,
    increment(key) {
      const now = clock();
      if (!Number.isFinite(now)) throw dashboardUnavailable();
      let entry = entries.get(key);
      if (entry && entry.expires <= now) {
        entries.delete(key);
        entry = undefined;
      }
      if (!entry) {
        if (entries.size >= capacity) {
          // At most capacity entries are inspected; no timer or detached work.
          for (const [id, value] of entries)
            if (value.expires <= now) entries.delete(id);
        }
        if (entries.size >= capacity) throw dashboardUnavailable();
        entry = { totalHits: 0, expires: now + windowMs };
        entries.set(key, entry);
      }
      entry.totalHits = Math.min(entry.totalHits + 1, Number.MAX_SAFE_INTEGER);
      return { totalHits: entry.totalHits, resetTime: new Date(entry.expires) };
    },
    decrement(key) {
      const entry = entries.get(key);
      if (entry) entry.totalHits = Math.max(0, entry.totalHits - 1);
    },
    resetKey(key) {
      entries.delete(key);
    },
  };
}

export function createDashboardRateLimits(
  config: DashboardLimits = dashboardLimitDefaults,
) {
  if (
    Object.values(config).some((n) => !Number.isSafeInteger(n) || n < 1) ||
    config.capacity > dashboardLimitDefaults.capacity ||
    config.windowMs > dashboardLimitDefaults.windowMs
  )
    throw dashboardUnavailable();
  const secret = randomBytes(32);
  const obscure = (value: string) =>
    createHmac('sha256', secret).update(value).digest('hex');
  const make = (max: number, keyGenerator: (req: Request) => string) =>
    rateLimit({
      limit: max,
      windowMs: config.windowMs,
      keyGenerator,
      store: createDashboardLimitStore(config.capacity, config.windowMs),
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
      if (!req.ip || !isIP(req.ip)) throw dashboardUnavailable();
      return obscure('ip:' + ipKeyGenerator(req.ip, 56));
    }),
    student: make(config.student, (req) => {
      if (req.auth?.role !== 'STUDENT' || !/^[a-f0-9]{24}$/.test(req.auth.sub))
        throw dashboardUnavailable();
      return obscure('student:' + req.auth.sub);
    }),
  };
}
