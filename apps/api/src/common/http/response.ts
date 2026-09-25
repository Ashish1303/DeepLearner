import type { ApiSuccess } from '@deeplearner/shared-types';

export function successResponse<T>(
  data: T,
  requestId: string,
  message: string | null = null,
): ApiSuccess<T> {
  return { success: true, data, message, meta: { requestId } };
}
