import {
  createPasswordRecoveryService,
  type PasswordRecoveryService,
} from './password-recovery.service.js';
import { passwordRecoveryRepository } from './password-recovery.repository.js';
import { createPasswordRecoveryController } from './password-recovery.controller.js';
import {
  createRecoveryRateLimits,
  type RecoveryLimits,
} from './password-recovery-rate-limit.js';
import {
  forgotPasswordRequest,
  resetPasswordRequest,
  changePasswordRequest,
} from './password-recovery.schema.js';
import { createRecoveryEmailService } from '../../common/email/email.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { createLogoutController } from './logout.controller.js';
import { createLogoutService, type LogoutService } from './logout.service.js';
import { logoutRepository } from './logout.repository.js';
import { logoutRequest } from './logout.schema.js';
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
  logoutService: LogoutService = createLogoutService(logoutRepository),
  recoveryService: PasswordRecoveryService = createPasswordRecoveryService({
    repository: passwordRecoveryRepository,
    email: createRecoveryEmailService(env),
    log: logger,
  }),
  recoveryLimits: RecoveryLimits = env,
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
  const logoutController = createLogoutController(
    logoutService,
    env.AUTH_COOKIE_SECURE,
  );
  router.post(
    '/logout',
    authOrigin(env),
    validateRequest(logoutRequest, (req, res) => {
      req.routeLabel = '/api/v1/auth/logout';
      return logoutController.logout(req, res);
    }),
  );
  router.post(
    '/logout-all',
    authOrigin(env),
    authenticate(createAccessTokens(env)),
    validateRequest(logoutRequest, (req, res) => {
      req.routeLabel = '/api/v1/auth/logout-all';
      return logoutController.logoutAll(req, res);
    }),
  );
  const recovery = createPasswordRecoveryController(
    recoveryService,
    env.AUTH_COOKIE_SECURE,
  );
  const recoveryLimit = createRecoveryRateLimits(recoveryLimits);
  router.post(
    '/forgot-password',
    ...recoveryLimit.forgot,
    validateRequest(forgotPasswordRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/forgot-password';
      return recovery.forgot(req, res, input.body.email);
    }),
  );
  router.post(
    '/reset-password',
    authOrigin(env),
    recoveryLimit.reset,
    validateRequest(resetPasswordRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/reset-password';
      return recovery.reset(req, res, input.body);
    }),
  );
  router.post(
    '/change-password',
    authOrigin(env),
    recoveryLimit.changeIp,
    authenticate(createAccessTokens(env)),
    recoveryLimit.changeUser,
    validateRequest(changePasswordRequest, (req, res, input) => {
      req.routeLabel = '/api/v1/auth/change-password';
      return recovery.change(req, res, input.body);
    }),
  );
  return router;
}
