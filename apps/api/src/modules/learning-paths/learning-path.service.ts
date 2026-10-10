import { AppError } from '../../common/errors/app-error.js';
import type { LearningPathRepository } from './learning-path.repository.js';
import type { LearningPathQuery } from './learning-path.schema.js';
export function createLearningPathService(repository: LearningPathRepository) {
  return {
    async list(query: LearningPathQuery) {
      const result = await repository.list(query);
      if (!result)
        throw new AppError(404, 'TECHNOLOGY_NOT_FOUND', 'Technology not found');
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
    async detail(id: string) {
      const result = await repository.detail(id);
      if (!result)
        throw new AppError(
          404,
          'LEARNING_PATH_NOT_FOUND',
          'Learning path not found',
        );
      return result;
    },
  };
}
export type LearningPathService = ReturnType<typeof createLearningPathService>;
