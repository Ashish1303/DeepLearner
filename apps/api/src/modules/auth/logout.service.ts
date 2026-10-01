import { AppError } from '../../common/errors/app-error.js';
import type { LogoutRepository } from './logout.repository.js';
import { parseRefreshToken } from './refresh-token.service.js';

export function createLogoutService(
  repository: LogoutRepository,
  now = () => new Date(),
) {
  return {
    async logout(raw: string | undefined, requestId: string) {
      if (!raw) return;
      let token: ReturnType<typeof parseRefreshToken>;
      try {
        token = parseRefreshToken(raw);
      } catch (error) {
        if (
          error instanceof AppError &&
          error.code === 'AUTH_REFRESH_TOKEN_INVALID'
        )
          return;
        throw error;
      }
      await repository.logout({ ...token, requestId }, now);
    },
    logoutAll(userId: string, requestId: string) {
      return repository.logoutAll({ userId, requestId }, now);
    },
  };
}
export type LogoutService = ReturnType<typeof createLogoutService>;
