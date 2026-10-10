import type { Request, Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@deeplearner/shared-types';
import type { TopicDto } from './topic.dto.js';
import type { TopicService } from './topic.service.js';
import type { TopicQuery } from './topic.schema.js';
export function createTopicController(service: TopicService) {
  return {
    async list(req: Request, res: Response, query: TopicQuery) {
      const result = await service.list(query);
      const body: ApiSuccess<TopicDto[], PaginationMeta> = {
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      };
      res.json(body);
    },
    async detail(req: Request, res: Response, id: string) {
      const body: ApiSuccess<TopicDto> = {
        success: true,
        data: await service.detail(id),
        message: null,
        meta: { requestId: req.requestId },
      };
      res.json(body);
    },
  };
}
