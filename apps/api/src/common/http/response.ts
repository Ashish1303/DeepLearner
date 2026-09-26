import type { ApiError, ApiSuccess } from '@deeplearner/shared-types';

export function successResponse<T>(
  data: T,
  requestId: string,
  message: string | null = null,
): ApiSuccess<T> {
  return { success: true, data, message, meta: { requestId } };
}

export function errorResponse(
  error: {
    code: string;
    message: string;
    details?: ApiError['error']['details'];
  },
  requestId: string,
): ApiError {
  // Select public fields explicitly; never spread an Error instance.
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    meta: { requestId },
  };
}
