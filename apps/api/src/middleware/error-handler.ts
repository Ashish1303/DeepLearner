import type { ErrorRequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { logger } from '../common/logging/logger.js';
import { errorResponse } from '../common/http/response.js';

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  let failure = new AppError(
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred',
  );
  if (error instanceof AppError) {
    failure = error;
  } else if (error instanceof Error && 'type' in error) {
    if (error.type === 'entity.parse.failed') {
      failure = new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid JSON request body',
      );
    } else if (error.type === 'entity.too.large') {
      failure = new AppError(
        413,
        'PAYLOAD_TOO_LARGE',
        'Request body is too large',
      );
    } else if (
      error.type === 'encoding.unsupported' ||
      error.type === 'charset.unsupported'
    ) {
      failure = new AppError(
        415,
        'UNSUPPORTED_MEDIA_TYPE',
        'Unsupported request body encoding or charset',
      );
    }
  }

  if (failure.statusCode >= 500) {
    logger.error(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.routeLabel ?? 'before_route',
        status: failure.statusCode,
        errorCode: failure.code,
      },
      'Request failed',
    );
  }

  res.status(failure.statusCode).json(errorResponse(failure, req.requestId));
};
