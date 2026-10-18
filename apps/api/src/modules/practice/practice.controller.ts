import type { Request, Response } from 'express';
import type { PracticeService } from './practice.service.js';
import type { PracticeQuery, PracticeUnlockInput } from './practice.schema.js';
export function createPracticeController(service: PracticeService) {
  return {
    async unlock(req: Request, res: Response, input: PracticeUnlockInput) {
      const data = await service.unlock(req.auth!, input);
      res.json({
        success: true,
        data,
        message: null,
        meta: { requestId: req.requestId },
      });
    },
    async list(req: Request, res: Response, query: PracticeQuery) {
      const result = await service.list(req.auth!, query);
      res.json({
        success: true,
        data: result.items,
        message: null,
        meta: { requestId: req.requestId, ...result.pagination },
      });
    },
  };
}
