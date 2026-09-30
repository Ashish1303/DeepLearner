import type { ClientSession, Types } from 'mongoose';
import { Audit } from './audit.model.js';

export async function appendAuthAudit(
  action: 'AUTH_REGISTERED' | 'AUTH_EMAIL_VERIFIED',
  userId: Types.ObjectId,
  requestId: string,
  session: ClientSession,
) {
  await Audit.create(
    [
      {
        category: 'AUTH',
        action,
        actorId: userId,
        resourceType: 'USER',
        resourceId: userId,
        requestId,
        metadata: { source: 'EMAIL_PASSWORD' },
      },
    ],
    { session },
  );
}

export interface LoginAudit {
  action:
    | 'AUTH_LOGIN_SUCCESS'
    | 'AUTH_LOGIN_FAILED'
    | 'AUTH_REFRESH_SUCCESS'
    | 'AUTH_REFRESH_REUSE_DETECTED';
  userId: Types.ObjectId | null;
  requestId: string;
  sessionId?: Types.ObjectId;
  failureReason?:
    | 'INVALID_CREDENTIALS'
    | 'EMAIL_NOT_VERIFIED'
    | 'ACCOUNT_DISABLED'
    | 'ACCOUNT_SUSPENDED'
    | 'TOKEN_REUSE';
  reactivatedFromExpiredSuspension?: boolean;
}
export async function appendLoginAudit(
  input: LoginAudit,
  session?: ClientSession,
) {
  const metadata = {
    source: input.action.startsWith('AUTH_REFRESH_')
      ? ('REFRESH_TOKEN' as const)
      : ('EMAIL_PASSWORD' as const),
    ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    ...(input.failureReason ? { failureReason: input.failureReason } : {}),
    ...(input.reactivatedFromExpiredSuspension
      ? { reactivatedFromExpiredSuspension: true }
      : {}),
  };
  await Audit.create(
    [
      {
        category: 'AUTH',
        action: input.action,
        actorId: input.userId,
        resourceId: input.userId,
        resourceType: 'USER',
        requestId: input.requestId,
        metadata,
      },
    ],
    session ? { session } : {},
  );
}
