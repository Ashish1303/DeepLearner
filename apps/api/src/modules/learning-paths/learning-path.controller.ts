import type { Request, Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@deeplearner/shared-types';
import type { LearningPathDto } from './learning-path.dto.js';
import type { LearningPathService } from './learning-path.service.js';
import type { LearningPathQuery } from './learning-path.schema.js';
export function createLearningPathController(service: LearningPathService) {
  return {
    async list(req: Request, res: Response, query: LearningPathQuery) {
      const result = await service.list(query);
      const body: ApiSuccess<LearningPathDto[], PaginationMeta> = {
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      };
      res.json(body);
    },
    async detail(req: Request, res: Response, id: string) {
      const body: ApiSuccess<LearningPathDto> = {
        success: true,
        data: await service.detail(id),
        message: null,
        meta: { requestId: req.requestId },
      };
      res.json(body);
    },
  };
}
