import { Router, type RequestHandler } from 'express';
import { AppError } from '../../../common/errors/app-error.js';
import { validateRequest } from '../../../middleware/validate.js';
import { routeLabel } from '../../../middleware/request-logger.js';
import { createAdminLearningPathController } from './admin-learning-path.controller.js';
import {
  createLearningPathReadLimit,
  type LearningPathReadLimits,
} from './admin-learning-path-rate-limit.js';
import {
  adminLearningPathDetailRequest,
  adminLearningPathListRequest,
} from './admin-learning-path.schema.js';
import {
  createAdminLearningPathService,
  type AdminLearningPathService,
} from './admin-learning-path.service.js';

/** Local body refusal; existing global parser and eligibility order remain intact. */
const noReadBody: RequestHandler = (req, _res, next) => {
  if (
    req.headers['transfer-encoding'] !== undefined ||
    (req.headers['content-length'] !== undefined &&
      req.headers['content-length'] !== '0') ||
    (req.body !== undefined &&
      (req.body === null ||
        typeof req.body !== 'object' ||
        Array.isArray(req.body) ||
        Reflect.ownKeys(req.body).length > 0))
  ) {
    return next(
      new AppError(
        400,
        'VALIDATION_ERROR',
        'GET requests cannot contain a body',
      ),
    );
  }
  next();
};
/** Must remain beneath the current-account F042 Admin namespace boundary. */
export function createAdminLearningPathRouter(
  service: AdminLearningPathService = createAdminLearningPathService(),
  limits?: LearningPathReadLimits,
) {
  const router = Router();
  const controller = createAdminLearningPathController(service);
  const limit = createLearningPathReadLimit(limits);
  router.use(routeLabel('/api/v1/admin/learning-paths/*'));
  router.get(
    '/',
    noReadBody,
    limit,
    validateRequest(adminLearningPathListRequest, (req, res, input) =>
      controller.list(req, res, input.query),
    ),
  );
  router.get(
    '/:id',
    noReadBody,
    limit,
    validateRequest(adminLearningPathDetailRequest, (req, res, input) =>
      controller.get(req, res, input.params.id, input.query.technologyId),
    ),
  );
  return router;
}
