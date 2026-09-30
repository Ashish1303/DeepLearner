import type { RequestHandler } from 'express';
import { AppError } from '../common/errors/app-error.js';
import type { AccessTokens } from '../modules/auth/access-token.service.js';
export function authenticate(tokens: AccessTokens): RequestHandler {
  return async (req, _res, next) => {
    try {
      const value = req.headers.authorization;
      if (!value)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_MISSING',
          'Access token required',
        );
      const match =
        /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(
          value,
        );
      if (!match)
        throw new AppError(
          401,
          'AUTH_ACCESS_TOKEN_INVALID',
          'Invalid access token',
        );
      req.auth = await tokens.verify(match[1]!);
      next();
    } catch (error) {
      next(error);
    }
  };
}
