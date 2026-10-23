import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { routeLabel } from '../../middleware/request-logger.js';
import { validateRequest } from '../../middleware/validate.js';
import { createAccessTokens } from '../auth/access-token.service.js';
import {
  createDashboardController,
  type DashboardService,
} from './dashboard.controller.js';
import {
  createDashboardRateLimits,
  type DashboardLimits,
} from './dashboard-rate-limit.js';
import { dashboardQuery } from './dashboard.schema.js';
import { createDashboardService } from './dashboard.service.js';

const requestSchema = z.strictObject({
  params: z.strictObject({}),
  query: dashboardQuery,
  body: z.undefined().optional(),
});
export function createDashboardRouter(
  service: DashboardService = createDashboardService(
    createAccessTokens(env),
    env,
  ),
  limits?: DashboardLimits,
) {
  const router = Router();
  const controller = createDashboardController(service);
  const limit = createDashboardRateLimits(limits);
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Express otherwise dispatches HEAD through GET handlers.
    if (env.APP_ENV !== 'LOCAL' || req.method !== 'GET') return next('router');
    next();
  });
  router.get(
    '/',
    routeLabel('/api/v1/dashboard'),
    limit.ip,
    authenticate(createAccessTokens(env)),
    (req, _res, next) => {
      if (req.auth?.role !== 'STUDENT')
        return next(
          new AppError(403, 'AUTH_FORBIDDEN', 'Student access required'),
        );
      next();
    },
    limit.student,
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
    validateRequest(requestSchema, (req, res, input) =>
      controller.get(req, res, input.query),
    ),
  );
  return router;
}
