import type { TechnologyRepository } from './technology.repository.js';
import type { TechnologyQuery } from './technology.schema.js';
export function createTechnologyService(repository: TechnologyRepository) {
  return {
    async list(query: TechnologyQuery) {
      const { items, total } = await repository.list(query);
      return {
        items,
        pagination: {
          ...query,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },
  };
}
export type TechnologyService = ReturnType<typeof createTechnologyService>;
