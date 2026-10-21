import { Router, type RequestHandler } from 'express';
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
import {
  createCompletionService,
  type CompletionService,
} from './completion.service.js';
import { createCompletionController } from './completion.controller.js';
import {
  completionGetRequest,
  completionIssueRequest,
  completionResponseRequest,
  completionCompleteRequest,
} from './completion.schema.js';
import { readIdempotencyKey } from '../practice/practice.schema.js';
export function createProgressRouter(
  service: ProgressService = createProgressService(
    progressRepository,
    userRepository,
  ),
  limits?: ProgressLimits,
  completionService: CompletionService = createCompletionService(
    createAccessTokens(env),
    env,
  ),
) {
  const router = Router(),
    controller = createProgressController(service),
    limit = createProgressRateLimits(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  if (env.APP_ENV === 'LOCAL') {
    const completion = createCompletionController(completionService);
    const student: RequestHandler = (req, _res, next) => {
      if (req.auth?.role !== 'STUDENT')
        return next(
          new AppError(403, 'AUTH_FORBIDDEN', 'Student access required'),
        );
      next();
    };
    router.get(
      '/completion',
      routeLabel('/api/v1/progress/completion'),
      limit.ip,
      authenticate(createAccessTokens(env)),
      student,
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
      validateRequest(completionGetRequest, (req, res, input) =>
        completion.get(req, res, input.query.conceptId),
      ),
    );
    const commands = [
      ['challenges', completionIssueRequest, completion.issue],
      ['responses', completionResponseRequest, completion.respond],
      ['complete', completionCompleteRequest, completion.complete],
    ] as const;
    for (const [path, schema, handle] of commands) {
      router.post(
        '/completion/:conceptId/' + path,
        routeLabel('/api/v1/progress/completion/:conceptId/' + path),
        limit.ip,
        authenticate(createAccessTokens(env)),
        student,
        limit.completionPost,
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
        validateRequest(schema, (req, res, input) =>
          handle(
            req,
            res,
            input.params.conceptId,
            input.body,
            readIdempotencyKey(req.rawHeaders),
          ),
        ),
      );
    }
  }
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
