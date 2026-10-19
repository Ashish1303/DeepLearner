import type { Request, Response } from 'express';
import type { ProgressService } from './progress.service.js';
export function createProgressController(service: ProgressService) {
  return {
    async get(req: Request, res: Response, conceptId: string) {
      const data = await service.get(req.auth!, conceptId);
      res.json({
        success: true,
        data,
        message: null,
        meta: { requestId: req.requestId },
      });
    },
  };
}
