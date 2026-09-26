import type { ApiError } from '@deeplearner/shared-types';

/** An expected failure with a message that is safe to send to clients. */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ApiError['error']['details'],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
