import type { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/http/response.js';
import type { LoginService } from './login.service.js';
import type { LoginInput } from './login.schema.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';
export function createLoginController(service: LoginService, secure: boolean) {
  return {
    async login(req: Request, res: Response, input: LoginInput) {
      const { refreshToken, expiresAt, ...data } = await service.login(
        input,
        req.requestId,
        req.headers['user-agent'] ?? '',
      );
      setRefreshCookie(res, secure, refreshToken, expiresAt);
      res.json(successResponse(data, req.requestId, 'Login successful'));
    },
    async refresh(req: Request, res: Response) {
      try {
        const { refreshToken, expiresAt, ...data } = await service.refresh(
          readRefreshCookie(req, secure),
          req.requestId,
        );
        setRefreshCookie(res, secure, refreshToken, expiresAt);
        res.json(successResponse(data, req.requestId));
      } catch (error) {
        if (error instanceof AppError && [401, 403].includes(error.statusCode))
          clearRefreshCookie(res, secure);
        throw error;
      }
    },
  };
}
