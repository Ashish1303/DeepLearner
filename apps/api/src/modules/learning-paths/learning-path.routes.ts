import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createLearningPathController } from './learning-path.controller.js';
import {
  createLearningPathService,
  type LearningPathService,
} from './learning-path.service.js';
import { learningPathRepository } from './learning-path.repository.js';
import {
  learningPathListRequest,
  learningPathDetailRequest,
} from './learning-path.schema.js';
import {
  createLearningPathRateLimit,
  learningPathLimitDefaults,
} from './learning-path-rate-limit.js';
export function createLearningPathRouter(
  service: LearningPathService = createLearningPathService(
    learningPathRepository,
  ),
  limits = learningPathLimitDefaults,
) {
  const router = Router();
  const controller = createLearningPathController(service);
  const limiter = createLearningPathRateLimit(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/',
    limiter,
    validateRequest(learningPathListRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/learning-paths';
      return controller.list(req, res, input.query);
    }),
  );
  router.get(
    '/:id',
    limiter,
    validateRequest(learningPathDetailRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/learning-paths/:id';
      return controller.detail(req, res, input.params.id);
    }),
  );
  return router;
}
