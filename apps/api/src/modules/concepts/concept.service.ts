import { AppError } from '../../common/errors/app-error.js';
import type { ConceptRepository } from './concept.repository.js';
import type { ConceptQuery } from './concept.schema.js';
export function createConceptService(repository: ConceptRepository) {
  return {
    async list(query: ConceptQuery) {
      const result = await repository.list(query);
      if (!result)
        throw new AppError(404, 'TOPIC_NOT_FOUND', 'Topic not found');
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
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
      return result;
    },
  };
}
export type ConceptService = ReturnType<typeof createConceptService>;
