import { createHash, randomBytes } from 'node:crypto';
import { authConfig } from '../../config/auth.js';
import { AppError } from '../../common/errors/app-error.js';

export const invalidResetToken = () =>
  new AppError(
    400,
    'AUTH_RESET_TOKEN_INVALID_OR_EXPIRED',
    'Reset token is invalid or expired',
  );
export function resetDigest(raw: string): string {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(raw) ||
    Buffer.from(raw, 'base64url').toString('base64url') !== raw
  )
    throw invalidResetToken();
  return createHash('sha256').update(raw).digest('hex');
}
export function issueResetToken(now: Date) {
  const raw = randomBytes(32).toString('base64url');
  return {
    raw,
    hash: resetDigest(raw),
    expiresAt: new Date(now.getTime() + authConfig.resetTokenLifetimeMs),
  };
}
