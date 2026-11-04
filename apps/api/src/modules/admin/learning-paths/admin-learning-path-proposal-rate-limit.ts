import { createHmac, randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../../../common/errors/app-error.js';
import { createAdminLimitStore } from '../admin-rate-limit.js';
import { proposalUnavailable } from './admin-learning-path-proposal.repository.js';

export const proposalLimitDefaults = {
  read: 120,
  capture: 60,
  windowMs: 60000,
  capacity: 10000,
};
export type ProposalLimits = typeof proposalLimitDefaults;
export function createProposalLimits(
  config: ProposalLimits = proposalLimitDefaults,
) {
  if (
    Object.keys(config).length !== 4 ||
    Object.values(config).some(
      (value) => !Number.isSafeInteger(value) || value < 1,
    ) ||
    config.capacity > 10000 ||
    config.windowMs > 60000 ||
    config.read > 120 ||
    config.capture > 60
  )
    throw proposalUnavailable();
  const secret = randomBytes(32);
  const make = (limit: number) =>
    rateLimit({
      limit,
      windowMs: config.windowMs,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      passOnStoreError: false,
      store: createAdminLimitStore(config.capacity, config.windowMs),
      keyGenerator(req) {
        if (
          !req.auth ||
          req.auth.role !== 'ADMIN' ||
          !/^[a-f0-9]{24}(?![\s\S])/.test(req.auth.sub)
        )
          throw proposalUnavailable();
        return createHmac('sha256', secret)
          .update('proposal:' + req.auth.sub)
          .digest('hex');
      },
      handler: (_req, _res, next) =>
        next(
          new AppError(
            429,
            'RATE_LIMIT_EXCEEDED',
            'Too many requests; try again later',
          ),
        ),
    });
  return { read: make(config.read), capture: make(config.capture) };
}
