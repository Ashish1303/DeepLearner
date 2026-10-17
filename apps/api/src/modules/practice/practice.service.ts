import { AppError } from '../../common/errors/app-error.js';
import type { UserRepository } from '../users/user.repository.js';
import type { PracticeRepository } from './practice.repository.js';
import type { PracticeQuery } from './practice.schema.js';
export function createPracticeService(
  repository: PracticeRepository,
  users: Pick<UserRepository, 'get'>,
) {
  return {
    async list(subject: { sub: string; role: string }, query: PracticeQuery) {
      const forbidden = () =>
        new AppError(403, 'AUTH_FORBIDDEN', 'Student access required');
      if (subject.role !== 'STUDENT') throw forbidden();
      const user = await users.get(subject.sub);
      if (user.role !== 'STUDENT' || user.id !== subject.sub) throw forbidden();
      if (user.status !== 'ACTIVE' || !user.emailVerified) {
        const code =
          user.status === 'DISABLED'
            ? 'AUTH_ACCOUNT_DISABLED'
            : user.status === 'SUSPENDED'
              ? 'AUTH_ACCOUNT_SUSPENDED'
              : 'AUTH_EMAIL_NOT_VERIFIED';
        throw new AppError(403, code, 'An eligible account is required');
      }
      const result = await repository.list(query);
      if (!result)
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
      return {
        items: result.items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / query.limit),
        },
      };
    },
  };
}
export type PracticeService = ReturnType<typeof createPracticeService>;
