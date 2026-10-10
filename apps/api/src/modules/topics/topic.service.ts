import { AppError } from '../../common/errors/app-error.js';
import type { TopicRepository } from './topic.repository.js';
import type { TopicQuery } from './topic.schema.js';
export function createTopicService(repository: TopicRepository) {
  return {
    async list(query: TopicQuery) {
      const result = await repository.list(query);
      if (!result)
        throw new AppError(404, 'MODULE_NOT_FOUND', 'Module not found');
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
        throw new AppError(404, 'TOPIC_NOT_FOUND', 'Topic not found');
      return result;
    },
  };
}
export type TopicService = ReturnType<typeof createTopicService>;
