import express, { Router, type RequestHandler } from 'express';
import { AppError } from '../../../common/errors/app-error.js';
import { validateRequest } from '../../../middleware/validate.js';
import { routeLabel } from '../../../middleware/request-logger.js';
import type { AccessTokens } from '../../auth/access-token.service.js';
import { createAdminTechnologyController } from './admin-technology.controller.js';
import {
  createTechnologyManagementLimits,
  type TechnologyLimits,
} from './admin-technology-rate-limit.js';
import {
  createAdminTechnologyService,
  type AdminTechnologyService,
} from './admin-technology.service.js';
import {
  technologyListRequest,
  technologyDetailRequest,
  technologyCreateRequest,
  technologyPatchRequest,
} from './admin-technology.schema.js';

/** Used before the global JSON parser; does not connect, provision, or authorize. */
export const technologyBodyParser: RequestHandler = (req, res, next) => {
  if (!/^\/api\/v1\/admin\/technologies(?:\/[^/]+)?\/?$/i.test(req.path))
    return next();
  if (req.method === 'GET') {
    if (
      req.headers['transfer-encoding'] ||
      (req.headers['content-length'] && req.headers['content-length'] !== '0')
    )
      return next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'GET requests cannot contain a body',
        ),
      );
    return next();
  }
  if (!['POST', 'PATCH'].includes(req.method)) return next();
  if (
    !/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(
      req.headers['content-type'] ?? '',
    ) ||
    !['identity', undefined].includes(req.headers['content-encoding'])
  )
    return next(
      new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON request required'),
    );
  return parseJson(req, res, next);
};
const parseJson = express.json({ limit: 4096, inflate: false, strict: true });

/** Must only be mounted after the F042 namespace gate. */
export function createAdminTechnologyRouter(
  tokens: Pick<AccessTokens, 'verify'>,
  service: AdminTechnologyService = createAdminTechnologyService(),
  limits?: TechnologyLimits,
) {
  const router = Router();
  const controller = createAdminTechnologyController(service, tokens);
  const limit = createTechnologyManagementLimits(limits);
  router.use(routeLabel('/api/v1/admin/technologies/*'));
  router.get(
    '/',
    limit.read,
    validateRequest(technologyListRequest, (req, res, input) =>
      controller.list(req, res, input.query),
    ),
  );
  router.get(
    '/:id',
    limit.read,
    validateRequest(technologyDetailRequest, (req, res, input) =>
      controller.get(req, res, input.params.id),
    ),
  );
  router.post(
    '/',
    limit.mutation,
    validateRequest(technologyCreateRequest, (req, res, input) =>
      controller.create(req, res, input.body),
    ),
  );
  router.patch(
    '/:id',
    limit.mutation,
    validateRequest(technologyPatchRequest, (req, res, input) =>
      controller.patch(req, res, input.params.id, input.body),
    ),
  );
  return router;
}
