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

export const app = express();
app.disable('x-powered-by');
app.use(requestId);
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'),
        );
      }
    },
    credentials: false,
    exposedHeaders: ['X-Request-Id'],
  }),
);
app.use(express.json({ limit: '256kb' }));
app.use('/api/v1/health', healthRouter);
app.use(notFound);
app.use(errorHandler);
