import type { AdminModuleService } from './modules/admin-module.service.js';
import type { ModuleReadLimits } from './modules/admin-module-rate-limit.js';
import { createAdminModuleRouter } from './modules/admin-module.routes.js';
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
import { createAdminLearningPathRouter } from './learning-paths/admin-learning-path.routes.js';
import type { AdminLearningPathService } from './learning-paths/admin-learning-path.service.js';
import type { LearningPathReadLimits } from './learning-paths/admin-learning-path-rate-limit.js';
import { createAdminLearningPathProposalRouter } from './learning-paths/admin-learning-path-proposal.routes.js';
import type { AdminLearningPathProposalService } from './learning-paths/admin-learning-path-proposal.service.js';
import type { ProposalLimits } from './learning-paths/admin-learning-path-proposal-rate-limit.js';

export function createAdminRouter(
  service: AdminAccessService = createAdminAccessService(),
  limits?: AdminLimits,
  technologies?: AdminTechnologyService,
  technologyLimits?: TechnologyLimits,
  learningPaths?: AdminLearningPathService,
  learningPathLimits?: LearningPathReadLimits,
  proposals?: AdminLearningPathProposalService,
  proposalLimits?: ProposalLimits,
  modules?: AdminModuleService,
  moduleLimits?: ModuleReadLimits,
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
  router.use('/modules', createAdminModuleRouter(modules, moduleLimits));
  router.use(
    '/technologies',
    createAdminTechnologyRouter(tokens, technologies, technologyLimits),
  );
  router.use(
    '/learning-paths',
    createAdminLearningPathRouter(learningPaths, learningPathLimits),
  );
  router.use(
    '/learning-path-proposals',
    createAdminLearningPathProposalRouter(tokens, proposals, proposalLimits),
  );
  return router;
}
