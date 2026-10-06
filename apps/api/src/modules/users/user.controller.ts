import type { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/http/response.js';
import type { UserService } from './user.service.js';
import type { ProfilePatch } from './user.schema.js';
function subject(req: Request) {
  if (!req.auth)
    throw new AppError(
      401,
      'AUTH_ACCESS_TOKEN_MISSING',
      'Access token required',
    );
  return req.auth.sub;
}
export function createUserController(service: UserService) {
  return {
    async get(req: Request, res: Response) {
      res.json(successResponse(await service.get(subject(req)), req.requestId));
    },
    async patch(req: Request, res: Response, input: ProfilePatch) {
      res.json(
        successResponse(
          await service.patch(subject(req), input, req.requestId),
          req.requestId,
        ),
      );
    },
  };
}
