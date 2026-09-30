import { authOrigin } from '../../middleware/auth-origin.js';
import { createAccessTokens } from './access-token.service.js';
import { createLoginController } from './login.controller.js';
import { loginRepository } from './login.repository.js';
import { createLoginService, type LoginService } from './login.service.js';
import { createLoginRateLimits, type LoginLimits } from './login-rate-limit.js';
import { loginRequest, refreshRequest } from './login.schema.js';
import { Router } from 'express';
import { validateRequest } from '../../middleware/validate.js';
import { createEmailService } from '../../common/email/email.service.js';
import { logger } from '../../common/logging/logger.js';
import { env } from '../../config/env.js';
import { createAuthController } from './auth.controller.js';
import { createAuthRateLimits, type AuthLimits } from './auth-rate-limit.js';
import {
  registrationRequest,
  verificationRequest,
  resendRequest,
} from './auth.schema.js';
import { registrationRepository } from './registration.repository.js';
import {
  createRegistrationService,
  type RegistrationService,
} from './registration.service.js';

export function createAuthRouter(
  service: RegistrationService = createRegistrationService({
    repository: registrationRepository,
    email: createEmailService(env),
    log: logger,
  }),
  limits: AuthLimits = env,
  loginService: LoginService = createLoginService({
    repository: loginRepository,
    tokens: createAccessTokens(env),
    log: logger,
  }),
  loginLimits: LoginLimits = env,
) {
  const router = Router();
  const controller = createAuthController(service);
  const limit = createAuthRateLimits(limits);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.post(
    '/register',
    limit.register,
    validateRequest(registrationRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/register';
      return controller.register(req, res, input.body);
    }),
  );
  router.post(
    '/verify-email',
    limit.verify,
    validateRequest(verificationRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/verify-email';
      return controller.verify(req, res, input.body.token);
    }),
  );
  router.post(
    '/resend-verification',
    ...limit.resend,
    validateRequest(resendRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/resend-verification';
      return controller.resend(req, res, input.body.email);
    }),
  );
  const loginController = createLoginController(
    loginService,
    env.AUTH_COOKIE_SECURE,
  );
  const loginLimit = createLoginRateLimits(loginLimits);
  router.post(
    '/login',
    authOrigin(env),
    ...loginLimit.login,
    validateRequest(loginRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/login';
      return loginController.login(req, res, input.body);
    }),
  );
  router.post(
    '/refresh',
    authOrigin(env),
    loginLimit.refresh,
    validateRequest(refreshRequest, (req, res) => {
      req.routeLabel = '/api/v1/auth/refresh';
      return loginController.refresh(req, res);
    }),
  );
  return router;
}
