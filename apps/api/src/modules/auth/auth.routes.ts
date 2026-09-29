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
  return router;
}
