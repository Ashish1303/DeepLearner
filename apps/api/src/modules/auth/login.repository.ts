import { Types } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { User, type UserRecord } from '../users/user.model.js';
import { Session } from './session.model.js';
import {
  appendLoginAudit,
  type LoginAudit,
} from '../audit/audit.repository.js';
import { matchesRefreshHash, refreshError } from './refresh-token.service.js';
import type { AuthContext } from './access-token.service.js';

export type LoginAccount = Pick<
  UserRecord,
  'email' | 'firstName' | 'lastName' | 'role' | 'plan' | 'status'
> & {
  id: string;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
  suspendedUntil: Date | null;
};
export function requireEligible(
  user: LoginAccount,
  now: Date,
  refresh = false,
) {
  if (user.status === 'DISABLED')
    throw new AppError(403, 'AUTH_ACCOUNT_DISABLED', 'Account is disabled');
  const reactivated =
    user.status === 'SUSPENDED' &&
    user.suspendedUntil instanceof Date &&
    Number.isFinite(user.suspendedUntil.getTime()) &&
    user.suspendedUntil <= now;
  if (user.status === 'SUSPENDED' && !reactivated)
    throw new AppError(403, 'AUTH_ACCOUNT_SUSPENDED', 'Account is suspended');
  if (user.status === 'PENDING_VERIFICATION' || !user.emailVerifiedAt) {
    if (refresh) throw refreshError('INVALID');
    throw new AppError(
      403,
      'AUTH_EMAIL_NOT_VERIFIED',
      'Verify your email before signing in',
    );
  }
  if (user.status !== 'ACTIVE' && !reactivated) throw refreshError('INVALID');
  return reactivated;
}
export function safeUser(user: LoginAccount) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    plan: user.plan,
    status: 'ACTIVE' as const,
  };
}
type Sign = (context: AuthContext) => Promise<string>;
export interface LoginRepository {
  find(email: string): Promise<LoginAccount | null>;
  login(
    input: {
      account: LoginAccount;
      sessionId: string;
      hash: string;
      expiresAt: Date;
      requestId: string;
      userAgent: string;
    },
    sign: Sign,
    now: () => Date,
  ): Promise<{ accessToken: string; user: ReturnType<typeof safeUser> }>;
  refresh(
    input: {
      sessionId: string;
      hash: string;
      replacement: string;
      requestId: string;
    },
    sign: Sign,
    now: () => Date,
  ): Promise<{ accessToken: string; expiresAt: Date }>;
  failedAudit(
    userId: string | null,
    reason: NonNullable<LoginAudit['failureReason']>,
    requestId: string,
  ): Promise<void>;
}
const unavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Authentication service is temporarily unavailable',
  );
async function safe<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable();
  }
}
async function requireSessionIndex() {
  const indexes = await Session.collection.listIndexes().toArray();
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        index.key.refreshTokenHash === 1 &&
        Object.keys(index.key).length === 1 &&
        !index.sparse &&
        !index.partialFilterExpression,
    )
  )
    throw unavailable();
}
export const loginRepository: LoginRepository = {
  find: (email) =>
    safe(async () => {
      const user = await User.findOne({ email }).select('+passwordHash');
      return user
        ? {
            id: String(user._id),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            plan: user.plan,
            status: user.status,
            passwordHash: user.passwordHash ?? null,
            emailVerifiedAt: user.emailVerifiedAt ?? null,
            suspendedUntil: user.suspendedUntil ?? null,
          }
        : null;
    }),
  login: (input, sign, now) =>
    safe(async () => {
      await requireSessionIndex();
      return mongoose.connection.transaction(async (session) => {
        const user = await User.findById(input.account.id)
          .where({ passwordHash: input.account.passwordHash })
          .session(session);
        if (!user)
          throw new AppError(
            401,
            'AUTH_INVALID_CREDENTIALS',
            'Invalid email or password',
          );
        const timestamp = now();
        const account = {
          ...input.account,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt ?? null,
          suspendedUntil: user.suspendedUntil ?? null,
          role: user.role,
          plan: user.plan,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        };
        const reactivated = requireEligible(account, timestamp);
        // A user write conflicts with concurrent status/credential changes, not just session writes.
        const updated = await User.updateOne(
          {
            _id: user._id,
            status: user.status,
            passwordHash: input.account.passwordHash,
            ...(reactivated ? { suspendedUntil: { $lte: timestamp } } : {}),
          },
          {
            $set: { status: 'ACTIVE', lastLoginAt: timestamp },
            $inc: { __v: 1 },
          },
          { session, runValidators: true },
        );
        if (updated.modifiedCount !== 1 || input.expiresAt <= timestamp)
          throw unavailable();
        const sessionId = new Types.ObjectId(input.sessionId);
        const accessToken = await sign({
          sub: account.id,
          sid: input.sessionId,
          role: account.role,
          plan: account.plan,
        });
        await Session.create(
          [
            {
              _id: sessionId,
              userId: user._id,
              refreshTokenHash: input.hash,
              expiresAt: input.expiresAt,
              createdAt: timestamp,
              lastUsedAt: timestamp,
              deviceInfo: { userAgent: input.userAgent.slice(0, 512) },
            },
          ],
          { session },
        );
        await appendLoginAudit(
          {
            action: 'AUTH_LOGIN_SUCCESS',
            userId: user._id,
            requestId: input.requestId,
            sessionId,
            reactivatedFromExpiredSuspension: reactivated,
          },
          session,
        );
        return { accessToken, user: safeUser(account) };
      });
    }),
  refresh: (input, sign, now) =>
    safe(async () => {
      const result = await mongoose.connection.transaction(
        async (transaction) => {
          const timestamp = now();
          const session = await Session.findById(input.sessionId)
            .select('+refreshTokenHash')
            .session(transaction);
          if (!session || session.revokedAt) throw refreshError('INVALID');
          if (session.expiresAt <= timestamp) throw refreshError('EXPIRED');
          if (!matchesRefreshHash(input.hash, session.refreshTokenHash)) {
            await Session.updateOne(
              { _id: session._id, revokedAt: null },
              {
                $set: {
                  revokedAt: timestamp,
                  revocationReason: 'REFRESH_TOKEN_REUSE',
                },
              },
              { session: transaction, runValidators: true },
            );
            await appendLoginAudit(
              {
                action: 'AUTH_REFRESH_REUSE_DETECTED',
                userId: session.userId,
                sessionId: session._id,
                requestId: input.requestId,
                failureReason: 'TOKEN_REUSE',
              },
              transaction,
            );
            return { reused: true as const };
          }
          const user = await User.findById(session.userId).session(transaction);
          if (!user) throw refreshError('INVALID');
          const account: LoginAccount = {
            id: String(user._id),
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            plan: user.plan,
            status: user.status,
            passwordHash: null,
            emailVerifiedAt: user.emailVerifiedAt ?? null,
            suspendedUntil: user.suspendedUntil ?? null,
          };
          const reactivated = requireEligible(account, timestamp, true);
          const updated = await User.updateOne(
            {
              _id: user._id,
              status: user.status,
              ...(reactivated ? { suspendedUntil: { $lte: timestamp } } : {}),
            },
            { $set: { status: 'ACTIVE' }, $inc: { __v: 1 } },
            { session: transaction, runValidators: true },
          );
          if (updated.modifiedCount !== 1) throw refreshError('INVALID');
          const rotated = await Session.updateOne(
            {
              _id: session._id,
              refreshTokenHash: input.hash,
              revokedAt: null,
              expiresAt: { $gt: now() },
            },
            {
              $set: {
                refreshTokenHash: input.replacement,
                lastUsedAt: timestamp,
              },
            },
            { session: transaction, runValidators: true },
          );
          if (rotated.modifiedCount !== 1) throw refreshError('INVALID');
          const accessToken = await sign({
            sub: account.id,
            sid: input.sessionId,
            role: account.role,
            plan: account.plan,
          });
          await appendLoginAudit(
            {
              action: 'AUTH_REFRESH_SUCCESS',
              userId: user._id,
              sessionId: session._id,
              requestId: input.requestId,
              reactivatedFromExpiredSuspension: reactivated,
            },
            transaction,
          );
          return {
            reused: false as const,
            accessToken,
            expiresAt: session.expiresAt,
          };
        },
      );
      if (result.reused) throw refreshError('REUSED');
      return { accessToken: result.accessToken, expiresAt: result.expiresAt };
    }),
  failedAudit: (userId, failureReason, requestId) =>
    appendLoginAudit({
      action: 'AUTH_LOGIN_FAILED',
      userId: userId ? new Types.ObjectId(userId) : null,
      requestId,
      failureReason,
    }),
};
