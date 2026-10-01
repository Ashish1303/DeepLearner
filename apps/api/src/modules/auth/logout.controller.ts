import type { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/http/response.js';
import { clearRefreshCookie, readRefreshCookie } from './refresh-cookie.js';
import type { LogoutService } from './logout.service.js';

export function createLogoutController(
  service: LogoutService,
  secure: boolean,
) {
  return {
    async logout(req: Request, res: Response) {
      let raw: string | undefined;
      try {
        raw = readRefreshCookie(req, secure);
      } catch (error) {
        if (
          !(error instanceof AppError) ||
          ![
            'AUTH_REFRESH_TOKEN_MISSING',
            'AUTH_REFRESH_TOKEN_INVALID',
          ].includes(error.code)
        )
          throw error;
      }
      await service.logout(raw, req.requestId);
      clearRefreshCookie(res, secure);
      res.json(successResponse(null, req.requestId, 'Logged out'));
    },
    async logoutAll(req: Request, res: Response) {
      if (!req.auth)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_MISSING',
          'Access token required',
        );
      const revokedSessions = await service.logoutAll(
        req.auth.sub,
        req.requestId,
      );
      clearRefreshCookie(res, secure);
      res.json(
        successResponse(
          { revokedSessions },
          req.requestId,
          'Logged out from all devices',
        ),
      );
    },
  };
}
