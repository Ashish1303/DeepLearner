import type { Request, Response } from 'express';
import { successResponse } from '../../common/http/response.js';
import { setRefreshCookie } from './refresh-cookie.js';
import type { GoogleAuthService } from './google-auth.service.js';
export function createGoogleAuthController(
  service: GoogleAuthService,
  secure: boolean,
) {
  return async (req: Request, res: Response, credential: string) => {
    const { created, refreshToken, expiresAt, ...data } = await service.login(
      credential,
      req.requestId,
      req.headers['user-agent'] ?? '',
    );
    setRefreshCookie(res, secure, refreshToken, expiresAt);
    res
      .status(created ? 201 : 200)
      .json(successResponse(data, req.requestId, 'Login successful'));
  };
}
