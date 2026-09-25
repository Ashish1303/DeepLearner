import type { ApiError } from '@deeplearner/shared-types';
import type { ErrorRequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import { logger } from '../common/logging/logger.js';

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
    }
  }

  if (failure.statusCode >= 500) {
    logger.error(
      { requestId: req.requestId, code: failure.code },
      'Request failed',
    );
  }

  const response: ApiError = {
    success: false,
    error: { code: failure.code, message: failure.message },
    meta: { requestId: req.requestId },
  };
  res.status(failure.statusCode).json(response);
};
