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
          /^\/api\/v1\/auth\/(login|refresh|logout|logout-all)\/?$/i.test(
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
    createAuthRouter(service, limits, loginService, loginLimits, logoutService),
  );
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
export const app = createApp();
