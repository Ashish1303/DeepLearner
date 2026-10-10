import type { Request, Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@deeplearner/shared-types';
import type { ModuleDto } from './module.dto.js';
import type { ModuleService } from './module.service.js';
import type { ModuleQuery } from './module.schema.js';
export function createModuleController(service: ModuleService) {
  return {
    async list(req: Request, res: Response, query: ModuleQuery) {
      const result = await service.list(query);
      const body: ApiSuccess<ModuleDto[], PaginationMeta> = {
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      };
      res.json(body);
    },
    async detail(req: Request, res: Response, id: string) {
      const body: ApiSuccess<ModuleDto> = {
        success: true,
        data: await service.detail(id),
        message: null,
        meta: { requestId: req.requestId },
      };
      res.json(body);
    },
  };
}
