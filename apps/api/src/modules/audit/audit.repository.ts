import type { ClientSession, Types } from 'mongoose';
import { Audit } from './audit.model.js';

type GoogleAudit = { userId: Types.ObjectId; requestId: string } & (
  | { action: 'AUTH_PROVIDER_LINKED' }
  | {
      action: 'AUTH_GOOGLE_LOGIN';
      sessionId: Types.ObjectId;
      reactivatedFromExpiredSuspension: boolean;
    }
);
export async function appendGoogleAudit(
  input: GoogleAudit,
  session: ClientSession,
) {
  await Audit.create(
    [
      {
        category: 'AUTH',
        action: input.action,
        actorId: input.userId,
        resourceId: input.userId,
        resourceType: 'USER',
        requestId: input.requestId,
        metadata:
          input.action === 'AUTH_PROVIDER_LINKED'
            ? { source: 'GOOGLE', provider: 'GOOGLE' }
            : {
                source: 'GOOGLE',
                sessionId: input.sessionId,
                reactivatedFromExpiredSuspension:
                  input.reactivatedFromExpiredSuspension,
              },
      },
    ],
    { session },
  );
}

type RecoveryAudit = { userId: Types.ObjectId; requestId: string } & (
  | { action: 'AUTH_PASSWORD_RESET_REQUESTED' }
  | { action: 'AUTH_PASSWORD_RESET'; revokedSessions: number }
  | {
      action: 'AUTH_PASSWORD_CHANGED';
      revokedSessions: number;
      sessionId: Types.ObjectId;
    }
);
export async function appendRecoveryAudit(
  input: RecoveryAudit,
  session: ClientSession,
) {
  await Audit.create(
    [
      {
        category: 'AUTH',
        action: input.action,
        actorId: input.userId,
        resourceId: input.userId,
        resourceType: 'USER',
        requestId: input.requestId,
        metadata:
          input.action === 'AUTH_PASSWORD_RESET_REQUESTED'
            ? { source: 'EMAIL_RECOVERY' }
            : {
                source:
                  input.action === 'AUTH_PASSWORD_CHANGED'
                    ? 'ACCESS_TOKEN'
                    : 'RESET_TOKEN',
                revokedSessions: input.revokedSessions,
                ...(input.action === 'AUTH_PASSWORD_CHANGED'
                  ? { sessionId: input.sessionId }
                  : {}),
              },
      },
    ],
    { session },
  );
}

type LogoutAudit = {
  userId: Types.ObjectId;
  requestId: string;
} & (
  | { action: 'AUTH_LOGOUT'; sessionId: Types.ObjectId }
  | { action: 'AUTH_LOGOUT_ALL'; revokedSessions: number }
);

export async function appendLogoutAudit(
  input: LogoutAudit,
  session: ClientSession,
) {
  await Audit.create(
    [
      {
        category: 'AUTH',
        action: input.action,
        actorId: input.userId,
        resourceId: input.userId,
        resourceType: 'USER',
        requestId: input.requestId,
        metadata:
          input.action === 'AUTH_LOGOUT'
            ? { source: 'REFRESH_TOKEN', sessionId: input.sessionId }
            : {
                source: 'ACCESS_TOKEN',
                revokedSessions: input.revokedSessions,
              },
      },
    ],
    { session },
  );
}

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
