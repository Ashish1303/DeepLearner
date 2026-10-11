import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createConceptController } from './concept.controller.js';
import {
  createConceptService,
  type ConceptService,
} from './concept.service.js';
import { conceptRepository } from './concept.repository.js';
import { conceptListRequest, conceptDetailRequest } from './concept.schema.js';
import {
  createConceptRateLimit,
  conceptLimitDefaults,
} from './concept-rate-limit.js';
export function createConceptRouter(
  service: ConceptService = createConceptService(conceptRepository),
  limits = conceptLimitDefaults,
) {
  const router = Router();
  const controller = createConceptController(service);
  const limiter = createConceptRateLimit(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/',
    limiter,
    validateRequest(conceptListRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/concepts';
      return controller.list(req, res, input.query);
    }),
  );
  router.get(
    '/:id',
    limiter,
    validateRequest(conceptDetailRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/concepts/:id';
      return controller.detail(req, res, input.params.id);
    }),
  );
  return router;
}
