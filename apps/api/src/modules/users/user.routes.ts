import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authOrigin } from '../../middleware/auth-origin.js';
import { validateRequest } from '../../middleware/validate.js';
import { createAccessTokens } from '../auth/access-token.service.js';
import { userRepository } from './user.repository.js';
import { createUserService, type UserService } from './user.service.js';
import { createUserController } from './user.controller.js';
import { createUserRateLimits, type UserLimits } from './user-rate-limit.js';
import { profileGetRequest, profilePatchRequest } from './user.schema.js';
export function createUserRouter(
  service: UserService = createUserService(userRepository),
  limits?: UserLimits,
) {
  const router = Router();
  const controller = createUserController(service);
  const limit = createUserRateLimits(limits);
  const auth = authenticate(createAccessTokens(env));
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/me',
    limit.ip,
    auth,
    limit.get,
    validateRequest(profileGetRequest, (req, res) => {
      req.routeLabel = '/api/v1/users/me';
      return controller.get(req, res);
    }),
  );
  router.patch(
    '/me',
    authOrigin(env),
    limit.ip,
    auth,
    limit.patch,
    validateRequest(profilePatchRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/users/me';
      return controller.patch(req, res, input.body);
    }),
  );
  return router;
}
