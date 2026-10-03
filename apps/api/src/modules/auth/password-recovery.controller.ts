import type { Request, Response } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { successResponse } from '../../common/http/response.js';
import type { PasswordRecoveryService } from './password-recovery.service.js';
import { clearRefreshCookie } from './refresh-cookie.js';

export function createPasswordRecoveryController(
  service: PasswordRecoveryService,
  secure: boolean,
) {
  return {
    async forgot(req: Request, res: Response, email: string) {
      await service.forgot(email, req.requestId);
      res
        .status(202)
        .json(
          successResponse(
            null,
            req.requestId,
            'If the account is eligible, password reset instructions will be requested. Check your email or try again later.',
          ),
        );
    },
    async reset(
      req: Request,
      res: Response,
      input: { token: string; newPassword: string },
    ) {
      await service.reset(input.token, input.newPassword, req.requestId);
      clearRefreshCookie(res, secure);
      res.json(
        successResponse(null, req.requestId, 'Password reset successfully'),
      );
    },
    async change(
      req: Request,
      res: Response,
      input: { currentPassword: string; newPassword: string },
    ) {
      if (!req.auth)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_MISSING',
          'Access token required',
        );
      await service.change(
        req.auth.sub,
        req.auth.sid,
        input.currentPassword,
        input.newPassword,
        req.requestId,
      );
      res.json(
        successResponse(null, req.requestId, 'Password changed successfully'),
      );
    },
  };
}
