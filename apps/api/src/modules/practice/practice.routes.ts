import { Router } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate.js';
import { createAccessTokens } from '../auth/access-token.service.js';
import { userRepository } from '../users/user.repository.js';
import { practiceRepository } from './practice.repository.js';
import {
  createPracticeService,
  type PracticeService,
} from './practice.service.js';
import { createPracticeController } from './practice.controller.js';
import {
  createPracticeRateLimits,
  type PracticeLimits,
} from './practice-rate-limit.js';
import {
  practiceListRequest,
  practiceUnlockRequest,
  readIdempotencyKey,
} from './practice.schema.js';
import { routeLabel } from '../../middleware/request-logger.js';
export function createPracticeRouter(
  service: PracticeService = createPracticeService(
    practiceRepository,
    userRepository,
  ),
  limits?: PracticeLimits,
) {
  const router = Router();
  const controller = createPracticeController(service);
  const limit = createPracticeRateLimits(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Temporary nonpersistent disclosure is available only in server-side LOCAL.
  if (env.APP_ENV === 'LOCAL')
    router.post(
      '/:questionId/unlock',
      routeLabel('/api/v1/practice-questions/:questionId/unlock'),
      limit.ip,
      authenticate(createAccessTokens(env)),
      limit.unlock,
      (req, _res, next) => {
        if (!req.is('application/json'))
          return next(
            new AppError(
              415,
              'UNSUPPORTED_MEDIA_TYPE',
              'JSON request body required',
            ),
          );
        next();
      },
      validateRequest(practiceUnlockRequest, (req, res, input) =>
        controller.unlock(req, res, {
          ...input.params,
          ...input.body,
          idempotencyKey: readIdempotencyKey(req.rawHeaders),
        }),
      ),
    );
  router.get(
    '/',
    limit.ip,
    authenticate(createAccessTokens(env)),
    limit.get,
    (req, _res, next) => {
      // express.json does not parse other content types; GET still accepts no body.
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
    validateRequest(practiceListRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/practice-questions';
      return controller.list(req, res, input.query);
    }),
  );
  return router;
}
