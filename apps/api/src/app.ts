import { createTechnologyRouter } from './modules/technologies/technology.routes.js';
import type { TechnologyService } from './modules/technologies/technology.service.js';
import type { technologyLimitDefaults } from './modules/technologies/technology-rate-limit.js';
import { createUserRouter } from './modules/users/user.routes.js';
import type { UserService } from './modules/users/user.service.js';
import type { UserLimits } from './modules/users/user-rate-limit.js';
import type { GoogleAuthService } from './modules/auth/google-auth.service.js';
import type { GoogleLimits } from './modules/auth/google-auth-rate-limit.js';
import type { PasswordRecoveryService } from './modules/auth/password-recovery.service.js';
import type { RecoveryLimits } from './modules/auth/password-recovery-rate-limit.js';
import type { LogoutService } from './modules/auth/logout.service.js';
import type { LoginService } from './modules/auth/login.service.js';
import type { LoginLimits } from './modules/auth/login-rate-limit.js';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { AppError } from './common/errors/app-error.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestId } from './middleware/request-id.js';
import { requestLogger } from './middleware/request-logger.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { RegistrationService } from './modules/auth/registration.service.js';
import type { AuthLimits } from './modules/auth/auth-rate-limit.js';

export function createApp(
  service?: RegistrationService,
  limits?: AuthLimits,
  loginService?: LoginService,
  loginLimits?: LoginLimits,
  logoutService?: LogoutService,
  recoveryService?: PasswordRecoveryService,
  recoveryLimits?: RecoveryLimits,
  googleService?: GoogleAuthService,
  googleLimits?: GoogleLimits,
  userService?: UserService,
  userLimits?: UserLimits,
  technologyService?: TechnologyService,
  technologyLimits?: typeof technologyLimitDefaults,
) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestId);
  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors((req, done) =>
      done(null, {
        origin(origin, callback) {
          if (!origin || env.CORS_ORIGINS.includes(origin)) {
            callback(null, true);
          } else {
            callback(
              new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'),
            );
          }
        },
        credentials:
          /^\/api\/v1\/auth\/(login|refresh|logout|logout-all|reset-password|google)\/?$/i.test(
            req.url.split('?')[0] ?? '',
          ),
        exposedHeaders: ['X-Request-Id'],
      }),
    ),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/v1/health', healthRouter);
  app.use(
    '/api/v1/auth',
    createAuthRouter(
      service,
      limits,
      loginService,
      loginLimits,
      logoutService,
      recoveryService,
      recoveryLimits,
      googleService,
      googleLimits,
    ),
  );
  app.use('/api/v1/users', createUserRouter(userService, userLimits));
  app.use(
    '/api/v1/technologies',
    createTechnologyRouter(technologyService, technologyLimits),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
export const app = createApp();
