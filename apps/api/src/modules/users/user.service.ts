import type { UserRepository } from './user.repository.js';
import type { ProfilePatch } from './user.schema.js';
export function createUserService(repository: UserRepository) {
  return {
    get: (userId: string) => repository.get(userId),
    patch: (userId: string, input: ProfilePatch, requestId: string) =>
      repository.patch(userId, input, requestId),
  };
}
export type UserService = ReturnType<typeof createUserService>;
