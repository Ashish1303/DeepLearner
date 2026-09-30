import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../common/errors/app-error.js';

export const refreshError = (
  kind: 'MISSING' | 'INVALID' | 'EXPIRED' | 'REUSED',
) =>
  new AppError(
    401,
    `AUTH_REFRESH_TOKEN_${kind}`,
    'Refresh session is unavailable; sign in again',
  );
export const refreshDigest = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');
export function issueRefreshSecret() {
  const secret = randomBytes(32).toString('base64url');
  return { secret, hash: refreshDigest(secret) };
}
export function parseRefreshToken(raw: string) {
  const match = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(raw);
  if (
    !match ||
    Buffer.from(match[2]!, 'base64url').toString('base64url') !== match[2]
  )
    throw refreshError('INVALID');
  return { sessionId: match[1]!, hash: refreshDigest(match[2]!) };
}
export function matchesRefreshHash(left: string, right: string) {
  return (
    /^[a-f0-9]{64}$/.test(left) &&
    /^[a-f0-9]{64}$/.test(right) &&
    timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
  );
}
