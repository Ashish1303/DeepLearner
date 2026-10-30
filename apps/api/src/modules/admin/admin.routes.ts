import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAdmin } from '../../middleware/require-admin.js';
import { routeLabel } from '../../middleware/request-logger.js';
import { createAccessTokens } from '../auth/access-token.service.js';
import {
  createAdminAccessService,
  type AdminAccessService,
} from './admin-access.service.js';
import { createAdminRateLimits, type AdminLimits } from './admin-rate-limit.js';
import { createAdminTechnologyRouter } from './technologies/admin-technology.routes.js';
import type { AdminTechnologyService } from './technologies/admin-technology.service.js';
import type { TechnologyLimits } from './technologies/admin-technology-rate-limit.js';

export function createAdminRouter(
  service: AdminAccessService = createAdminAccessService(),
  limits?: AdminLimits,
  technologies?: AdminTechnologyService,
  technologyLimits?: TechnologyLimits,
) {
  const router = Router();
  const limit = createAdminRateLimits(limits);
  const tokens = createAccessTokens(env);
  router.use(
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    routeLabel('/api/v1/admin/*'),
    limit.ip,
    authenticate(tokens),
    limit.account,
    requireAdmin(service),
  );
  router.use(
    '/technologies',
    createAdminTechnologyRouter(tokens, technologies, technologyLimits),
  );
  return router;
}
