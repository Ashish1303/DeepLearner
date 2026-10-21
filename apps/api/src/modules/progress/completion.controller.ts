import type { Request, Response } from 'express';
import type { CompletionService } from './completion.service.js';
export function createCompletionController(service: CompletionService) {
  const send = (req: Request, res: Response, data: unknown) =>
    res.json({
      success: true,
      data,
      message: null,
      meta: { requestId: req.requestId },
    });
  const token = (req: Request) => req.headers.authorization?.slice(7) ?? '';
  return {
    async get(req: Request, res: Response, concept: string) {
      send(req, res, await service.get(req.auth!, concept));
    },
    async complete(
      req: Request,
      res: Response,
      concept: string,
      body: unknown,
      key: string,
    ) {
      send(req, res, await service.complete(req.auth!, concept, body, key));
    },
    async issue(
      req: Request,
      res: Response,
      concept: string,
      body: unknown,
      key: string,
    ) {
      send(
        req,
        res,
        await service.issue(
          req.auth!,
          token(req),
          concept,
          body,
          key,
          req.requestId,
        ),
      );
    },
    async respond(
      req: Request,
      res: Response,
      concept: string,
      body: unknown,
      key: string,
    ) {
      send(
        req,
        res,
        await service.respond(
          req.auth!,
          token(req),
          concept,
          body,
          key,
          req.requestId,
        ),
      );
    },
  };
}
