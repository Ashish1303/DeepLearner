import { Router } from 'express';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate.js';
import { routeLabel } from '../../middleware/request-logger.js';
import { createAccessTokens } from '../auth/access-token.service.js';
import { userRepository } from '../users/user.repository.js';
import { progressRepository } from './progress.repository.js';
import {
  createProgressService,
  type ProgressService,
} from './progress.service.js';
import { createProgressController } from './progress.controller.js';
import {
  createProgressRateLimits,
  type ProgressLimits,
} from './progress-rate-limit.js';
import { progressRequest } from './progress.schema.js';
export function createProgressRouter(
  service: ProgressService = createProgressService(
    progressRepository,
    userRepository,
  ),
  limits?: ProgressLimits,
) {
  const router = Router(),
    controller = createProgressController(service),
    limit = createProgressRateLimits(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/',
    routeLabel('/api/v1/progress'),
    limit.ip,
    authenticate(createAccessTokens(env)),
    limit.get,
    (req, _res, next) => {
      if (
        Number(req.headers['content-length'] ?? 0) > 0 ||
        req.headers['transfer-encoding'] !== undefined
      )
        return next(
          new AppError(
            400,
            'VALIDATION_ERROR',
            'GET requests must not contain a body',
          ),
        );
      next();
    },
    validateRequest(progressRequest, (req, res, input) =>
      controller.get(req, res, input.query.conceptId),
    ),
  );
  return router;
}
