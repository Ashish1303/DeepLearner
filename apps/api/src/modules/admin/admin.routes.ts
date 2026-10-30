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

export function createAdminRouter(
  service: AdminAccessService = createAdminAccessService(),
  limits?: AdminLimits,
) {
  const router = Router();
  const limit = createAdminRateLimits(limits);
  router.use(
    (_req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    routeLabel('/api/v1/admin/*'),
    limit.ip,
    authenticate(createAccessTokens(env)),
    limit.account,
    requireAdmin(service),
  );
  // No business endpoint. Future Admin handlers belong below this boundary.
  return router;
}
