import { Types } from 'mongoose';
import { authConfig } from '../../config/auth.js';
import type { GoogleIdentityVerifier } from './google-identity.service.js';
import type { GoogleAuthRepository } from './google-auth.repository.js';
import type { AccessTokens } from './access-token.service.js';
import { issueRefreshSecret } from './refresh-token.service.js';

export function createGoogleAuthService(deps: {
  identity: GoogleIdentityVerifier;
  repository: GoogleAuthRepository;
  tokens: AccessTokens;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return {
    async login(credential: string, requestId: string, userAgent = '') {
      const identity = await deps.identity.verify(credential);
      const sessionId = new Types.ObjectId().toHexString();
      const secret = issueRefreshSecret();
      const expiresAt = new Date(
        now().getTime() + authConfig.sessionLifetimeMs,
      );
      const result = await deps.repository.login(
        {
          identity,
          sessionId,
          hash: secret.hash,
          expiresAt,
          requestId,
          userAgent,
        },
        deps.tokens.sign,
        now,
      );
      return {
        ...result,
        refreshToken: `${sessionId}.${secret.secret}`,
        expiresAt,
        expiresInSeconds: 900,
      };
    },
  };
}
export type GoogleAuthService = ReturnType<typeof createGoogleAuthService>;
