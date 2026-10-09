import type { Request, Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@deeplearner/shared-types';
import type { TechnologyDto } from './technology.dto.js';
import type { TechnologyService } from './technology.service.js';
import type { TechnologyQuery } from './technology.schema.js';
export function createTechnologyController(service: TechnologyService) {
  return {
    async list(req: Request, res: Response, query: TechnologyQuery) {
      const result = await service.list(query);
      const body: ApiSuccess<TechnologyDto[], PaginationMeta> = {
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      };
      res.json(body);
    },
  };
}
