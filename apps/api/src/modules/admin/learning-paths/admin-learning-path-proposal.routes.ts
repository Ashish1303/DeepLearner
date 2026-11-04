import express, { Router, type RequestHandler } from 'express';
import { AppError } from '../../../common/errors/app-error.js';
import { validateRequest } from '../../../middleware/validate.js';
import { routeLabel } from '../../../middleware/request-logger.js';
import type { AccessTokens } from '../../auth/access-token.service.js';
import { createAdminLearningPathProposalController } from './admin-learning-path-proposal.controller.js';
import {
  createProposalLimits,
  type ProposalLimits,
} from './admin-learning-path-proposal-rate-limit.js';
import {
  proposalCaptureRequest,
  proposalRecoveryRequest,
  proposalDetailRequest,
} from './admin-learning-path-proposal-request.schema.js';
import {
  createAdminLearningPathProposalService,
  type AdminLearningPathProposalService,
} from './admin-learning-path-proposal.service.js';

export const proposalBodyLimit = 131072;
const parseJson = express.json({
  limit: proposalBodyLimit,
  inflate: false,
  strict: true,
});
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
  )
    return next(
      new AppError(
        400,
        'VALIDATION_ERROR',
        'GET requests cannot contain a body',
      ),
    );
  next();
};
/** Only stream-parse these routes, before the existing global JSON parser. */
export const proposalBodyParser: RequestHandler = (req, res, next) => {
  const path = req.path;
  const base = /^\/api\/v1\/admin\/learning-path-proposals\/?$/i.test(path);
  const detail = /^\/api\/v1\/admin\/learning-path-proposals\/[^/]+\/?$/i.test(
    path,
  );
  const recovery =
    /^\/api\/v1\/admin\/learning-path-proposals\/operations\/[^/]+\/?$/i.test(
      path,
    );
  if (req.method === 'GET' && (detail || recovery))
    return noReadBody(req, res, next);
  if (req.method !== 'POST' || !base) return next();
  if (
    !/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(
      req.headers['content-type'] ?? '',
    ) ||
    ![undefined, 'identity'].includes(req.headers['content-encoding'])
  )
    return next(
      new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON request required'),
    );
  return parseJson(req, res, next);
};

/** Mounted only after existing F042 IP/JWT/account/current-Admin guards. */
export function createAdminLearningPathProposalRouter(
  tokens: Pick<AccessTokens, 'verify'>,
  service: AdminLearningPathProposalService = createAdminLearningPathProposalService(),
  limits?: ProposalLimits,
) {
  const router = Router();
  const controller = createAdminLearningPathProposalController(service, tokens);
  const limit = createProposalLimits(limits);
  router.use(routeLabel('/api/v1/admin/learning-path-proposals/*'));
  // Express otherwise dispatches HEAD through GET. This slice exposes only its
  // three declared business operations; unsupported methods fall through to404.
  router.use((req, _res, next) => {
    if (!['GET', 'POST'].includes(req.method)) return next('router');
    next();
  });
  router.post(
    '/',
    limit.capture,
    validateRequest(proposalCaptureRequest, (req, res, input) =>
      controller.capture(req, res, input.body),
    ),
  );
  router.get(
    '/operations/:operationId',
    noReadBody,
    limit.read,
    validateRequest(proposalRecoveryRequest, (req, res, input) =>
      controller.reconcile(
        req,
        res,
        input.params.operationId,
        input.query.technologyId,
      ),
    ),
  );
  router.get(
    '/:id',
    noReadBody,
    limit.read,
    validateRequest(proposalDetailRequest, (req, res, input) =>
      controller.get(req, res, input.params.id, input.query.technologyId),
    ),
  );
  return router;
}
