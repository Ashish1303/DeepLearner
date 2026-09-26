import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import { logger } from '../common/logging/logger.js';

/** Only pass a developer-defined route template, never req.path/baseUrl/url. */
export function routeLabel(route: string): RequestHandler {
  return (req, _res, next) => {
    req.routeLabel = route;
    next();
  };
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on('finish', () => {
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.routeLabel ?? 'before_route',
        status: res.statusCode,
        durationMs: Math.round(performance.now() - started),
      },
      'Request completed',
    );
  });
  next();
};
