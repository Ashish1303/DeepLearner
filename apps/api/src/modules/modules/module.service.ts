import { AppError } from '../../common/errors/app-error.js';
import type { ModuleRepository } from './module.repository.js';
import type { ModuleQuery } from './module.schema.js';
export function createModuleService(repository: ModuleRepository) {
  return {
    async list(query: ModuleQuery) {
      const result = await repository.list(query);
      if (!result)
        throw new AppError(
          404,
          'LEARNING_PATH_NOT_FOUND',
          'Learning path not found',
        );
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
        throw new AppError(404, 'MODULE_NOT_FOUND', 'Module not found');
      return result;
    },
  };
}
export type ModuleService = ReturnType<typeof createModuleService>;
