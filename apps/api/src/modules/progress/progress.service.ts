import { AppError } from '../../common/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { ProgressRepository } from './progress.repository.js';
import { progressDtoSchema } from './progress.dto.js';
export function createProgressService(
  repository: Pick<ProgressRepository, 'read'>,
  users: Pick<UserRepository, 'get'>,
) {
  async function eligible(subject: { sub: string; role: string }) {
    if (subject.role !== 'STUDENT')
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
    const user = await users.get(subject.sub);
    if (user.id !== subject.sub || user.role !== 'STUDENT')
      throw new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
    if (user.status !== 'ACTIVE' || !user.emailVerified)
      throw new AppError(
        403,
        user.status === 'DISABLED'
          ? 'AUTH_ACCOUNT_DISABLED'
          : user.status === 'SUSPENDED'
            ? 'AUTH_ACCOUNT_SUSPENDED'
            : 'AUTH_EMAIL_NOT_VERIFIED',
        'An eligible account is required',
      );
  }
  return {
    async get(subject: { sub: string; role: string }, conceptId: string) {
      await eligible(subject);
      const result = await repository.read(subject.sub, conceptId);
      await eligible(subject);
      const parsed = progressDtoSchema.safeParse(result);
      if (!parsed.success || parsed.data.conceptId !== conceptId)
        throw new AppError(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Activity is temporarily unavailable',
        );
      return parsed.data;
    },
  };
}
export type ProgressService = ReturnType<typeof createProgressService>;
