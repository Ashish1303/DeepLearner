import type { Request, Response } from 'express';
import { successResponse } from '../../../common/http/response.js';
import type { AdminLearningPathQuery } from './admin-learning-path.schema.js';
import type {
  AdminLearningPathService,
  LearningPathAuthority,
} from './admin-learning-path.service.js';

export function createAdminLearningPathController(
  service: AdminLearningPathService,
) {
  async function send(
    req: Request,
    res: Response,
    execute: (authority: LearningPathAuthority) => Promise<unknown>,
    list = false,
  ) {
    const abort = new AbortController();
    const lose = () => abort.abort();
    req.once('aborted', lose);
    res.once('close', lose);
    if (req.aborted || res.destroyed) lose();
    try {
      const value = await execute({ actor: req.auth, signal: abort.signal });
      if (abort.signal.aborted || req.aborted || res.destroyed) return;
      if (list) {
        const page = value as Awaited<
          ReturnType<AdminLearningPathService['list']>
        >;
        res.status(200).json({
          success: true,
          data: page.items,
          message: null,
          meta: { requestId: req.requestId, ...page.pagination },
        });
      } else res.status(200).json(successResponse(value, req.requestId));
    } catch (error) {
      if (abort.signal.aborted || req.aborted || res.destroyed) return;
      throw error;
    } finally {
      abort.abort();
      req.removeListener('aborted', lose);
      res.removeListener('close', lose);
    }
  }
  return {
    list: (req: Request, res: Response, query: AdminLearningPathQuery) =>
      send(req, res, (authority) => service.list(query, authority), true),
    get: (req: Request, res: Response, id: string, technologyId: string) =>
      send(req, res, (authority) => service.get(id, technologyId, authority)),
  };
}
