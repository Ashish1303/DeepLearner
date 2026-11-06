import { Router, type RequestHandler } from 'express';
import { AppError } from '../../../common/errors/app-error.js';
import { validateRequest } from '../../../middleware/validate.js';
import { routeLabel } from '../../../middleware/request-logger.js';
import { createAdminModuleController } from './admin-module.controller.js';
import {
  createModuleReadLimit,
  type ModuleReadLimits,
} from './admin-module-rate-limit.js';
import {
  adminModuleDetailRequest,
  adminModuleListRequest,
} from './admin-module.schema.js';
import {
  createAdminModuleService,
  type AdminModuleService,
} from './admin-module.service.js';

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
export function createAdminModuleRouter(
  service: AdminModuleService = createAdminModuleService(),
  limits?: ModuleReadLimits,
) {
  const router = Router();
  const controller = createAdminModuleController(service);
  const limit = createModuleReadLimit(limits);
  router.use(routeLabel('/api/v1/admin/modules/*'));
  router.get(
    '/',
    noReadBody,
    limit,
    validateRequest(adminModuleListRequest, (req, res, input) =>
      controller.list(req, res, input.query),
    ),
  );
  router.get(
    '/:id',
    noReadBody,
    limit,
    validateRequest(adminModuleDetailRequest, (req, res, input) =>
      controller.get(
        req,
        res,
        input.params.id,
        input.query.technologyId,
        input.query.learningPathId,
      ),
    ),
  );
  return router;
}
