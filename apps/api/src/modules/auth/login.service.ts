import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { authConfig } from '../../config/auth.js';
import type { AccessTokens } from './access-token.service.js';
import type { LoginRepository } from './login.repository.js';
import type { LoginInput } from './login.schema.js';
import { hashPassword, verifyPassword } from './password.service.js';
import {
  issueRefreshSecret,
  parseRefreshToken,
} from './refresh-token.service.js';
let dummy: Promise<string> | undefined;
const dummyHash = () =>
  (dummy ??= hashPassword(randomBytes(32).toString('base64url')));
export function createLoginService(deps: {
  repository: LoginRepository;
  tokens: AccessTokens;
  log: {
    warn(fields: { requestId: string; event: string }, message: string): void;
  };
  verify?: typeof verifyPassword;
  dummy?: () => Promise<string>;
  now?: () => Date;
}) {
  const now = deps.now ?? (() => new Date());
  return {
    async login(input: LoginInput, requestId: string, userAgent = '') {
      const account = await deps.repository.find(input.email);
      try {
        const valid = await (deps.verify ?? verifyPassword)(
          input.password,
          account?.passwordHash ?? (await (deps.dummy ?? dummyHash)()),
        );
        if (!account?.passwordHash || !valid)
          throw new AppError(
            401,
            'AUTH_INVALID_CREDENTIALS',
            'Invalid email or password',
          );
        const issued = issueRefreshSecret();
        const sessionId = new Types.ObjectId().toHexString();
        const expiresAt = new Date(
          now().getTime() + authConfig.sessionLifetimeMs,
        );
        const result = await deps.repository.login(
          {
            account,
            sessionId,
            hash: issued.hash,
            expiresAt,
            requestId,
            userAgent,
          },
          deps.tokens.sign,
          now,
        );
        return {
          ...result,
          expiresInSeconds: 900,
          refreshToken: `${sessionId}.${issued.secret}`,
          expiresAt,
        };
      } catch (error) {
        if (
          error instanceof AppError &&
          [401, 403].includes(error.statusCode)
        ) {
          const reason =
            error.code === 'AUTH_ACCOUNT_DISABLED'
              ? 'ACCOUNT_DISABLED'
              : error.code === 'AUTH_ACCOUNT_SUSPENDED'
                ? 'ACCOUNT_SUSPENDED'
                : error.code === 'AUTH_EMAIL_NOT_VERIFIED'
                  ? 'EMAIL_NOT_VERIFIED'
                  : 'INVALID_CREDENTIALS';
          try {
            await deps.repository.failedAudit(
              account?.id ?? null,
              reason,
              requestId,
            );
          } catch {
            deps.log.warn(
              { requestId, event: 'AUTH_AUDIT_WRITE_FAILED' },
              'Authentication failure audit unavailable',
            );
          }
        }
        throw error;
      }
    },
    async refresh(raw: string, requestId: string) {
      const parsed = parseRefreshToken(raw);
      const issued = issueRefreshSecret();
      const result = await deps.repository.refresh(
        { ...parsed, replacement: issued.hash, requestId },
        deps.tokens.sign,
        now,
      );
      return {
        ...result,
        expiresInSeconds: 900,
        refreshToken: `${parsed.sessionId}.${issued.secret}`,
      };
    },
  };
}
export type LoginService = ReturnType<typeof createLoginService>;
