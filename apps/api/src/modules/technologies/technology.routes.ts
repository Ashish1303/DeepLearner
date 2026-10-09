import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createTechnologyController } from './technology.controller.js';
import {
  createTechnologyService,
  type TechnologyService,
} from './technology.service.js';
import { technologyRepository } from './technology.repository.js';
import { technologyRequest } from './technology.schema.js';
import {
  createTechnologyRateLimit,
  technologyLimitDefaults,
} from './technology-rate-limit.js';
export function createTechnologyRouter(
  service: TechnologyService = createTechnologyService(technologyRepository),
  limits = technologyLimitDefaults,
) {
  const router = Router();
  const controller = createTechnologyController(service);
  router.get(
    '/',
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    createTechnologyRateLimit(limits),
    validateRequest(technologyRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/technologies';
      return controller.list(req, res, input.query);
    }),
  );
  return router;
}
