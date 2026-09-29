import { createHash, randomBytes } from 'node:crypto';
import { authConfig } from '../../config/auth.js';

export function digestToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
export function issueVerificationToken(now: Date) {
  const raw = randomBytes(32).toString('base64url');
  return {
    raw,
    hash: digestToken(raw),
    expiresAt: new Date(now.getTime() + authConfig.tokenLifetimeMs),
  };
}
