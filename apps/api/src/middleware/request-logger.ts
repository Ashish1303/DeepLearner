import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import { logger } from '../common/logging/logger.js';

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        // A fixed route label avoids logging user-controlled URLs or query secrets.
        action:
          req.method === 'GET' && req.path === '/api/v1/health'
            ? 'health'
            : 'http_request',
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      },
      'Request completed',
    );
  });
  next();
};
