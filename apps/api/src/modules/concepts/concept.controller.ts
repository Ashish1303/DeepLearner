import type { Request, Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@deeplearner/shared-types';
import type { ConceptSummaryDto, ConceptDetailDto } from './concept.dto.js';
import type { ConceptService } from './concept.service.js';
import type { ConceptQuery } from './concept.schema.js';
export function createConceptController(service: ConceptService) {
  return {
    async list(req: Request, res: Response, query: ConceptQuery) {
      const result = await service.list(query);
      const body: ApiSuccess<ConceptSummaryDto[], PaginationMeta> = {
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      };
      res.json(body);
    },
    async detail(req: Request, res: Response, id: string) {
      const body: ApiSuccess<ConceptDetailDto> = {
        success: true,
        data: await service.detail(id),
        message: null,
        meta: { requestId: req.requestId },
      };
      res.json(body);
    },
  };
}
