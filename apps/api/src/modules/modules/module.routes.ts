import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createModuleController } from './module.controller.js';
import { createModuleService, type ModuleService } from './module.service.js';
import { moduleRepository } from './module.repository.js';
import { moduleListRequest, moduleDetailRequest } from './module.schema.js';
import {
  createModuleRateLimit,
  moduleLimitDefaults,
} from './module-rate-limit.js';
export function createModuleRouter(
  service: ModuleService = createModuleService(moduleRepository),
  limits = moduleLimitDefaults,
) {
  const router = Router();
  const controller = createModuleController(service);
  const limiter = createModuleRateLimit(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/',
    limiter,
    validateRequest(moduleListRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/modules';
      return controller.list(req, res, input.query);
    }),
  );
  router.get(
    '/:id',
    limiter,
    validateRequest(moduleDetailRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/modules/:id';
      return controller.detail(req, res, input.params.id);
    }),
  );
  return router;
}
