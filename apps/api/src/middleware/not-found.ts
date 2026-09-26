import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';

export const notFound: RequestHandler = (req, _res, next) => {
  req.routeLabel = 'unmatched';
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found'));
};
