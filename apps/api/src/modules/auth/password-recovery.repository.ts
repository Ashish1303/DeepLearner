import { Types } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { User } from '../users/user.model.js';
import { Session } from './session.model.js';
import { PasswordResetToken } from './password-reset-token.model.js';
import { appendRecoveryAudit } from '../audit/audit.repository.js';
import { invalidResetToken } from './password-reset-token.service.js';

const eligible = {
  status: 'ACTIVE',
  emailVerifiedAt: { $ne: null },
  passwordHash: { $type: 'string', $ne: '' },
} as const;
export interface RecoveryRecipient {
  email: string;
  firstName: string;
  tokenId: string;
}
export interface PasswordRecoveryRepository {
  forgot(
    email: string,
    token: { hash: string; expiresAt: Date },
    requestId: string,
  ): Promise<RecoveryRecipient | null>;
  checkReset(hash: string, now: () => Date): Promise<void>;
  reset(
    hash: string,
    passwordHash: string,
    requestId: string,
    now: () => Date,
  ): Promise<RecoveryRecipient>;
  current(userId: string, sessionId: string, now: () => Date): Promise<string>;
  change(
    input: {
      userId: string;
      sessionId: string;
      oldHash: string;
      newHash: string;
      requestId: string;
    },
    now: () => Date,
  ): Promise<void>;
}
async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication service is temporarily unavailable',
    );
  }
}
async function prerequisites() {
  // Common preflight before eligibility branching; never provision indexes here.
  for (const [collection, field] of [
    [User.collection, 'email'],
    [PasswordResetToken.collection, 'tokenHash'],
  ] as const) {
    const indexes = await collection.listIndexes().toArray();
    if (
      !indexes.some(
        (index) =>
          index.unique === true &&
          index.key[field] === 1 &&
          Object.keys(index.key).length === 1 &&
          !index.sparse &&
          !index.partialFilterExpression,
      )
    )
      throw new Error('Required index missing');
  }
}
const live = (userId: string, sessionId: string, now: Date) => ({
  _id: new Types.ObjectId(sessionId),
  userId: new Types.ObjectId(userId),
  revokedAt: null,
  expiresAt: { $gt: now },
});
function invalidSession() {
  return new AppError(
    401,
    'AUTH_ACCESS_TOKEN_INVALID',
    'Current session is unavailable',
  );
}
function currentPasswordInvalid() {
  return new AppError(
    401,
    'AUTH_CURRENT_PASSWORD_INVALID',
    'Current password is invalid',
  );
}
export const passwordRecoveryRepository: PasswordRecoveryRepository = {
  forgot: (email, token, requestId) =>
    safe(async () => {
      await prerequisites();
      return mongoose.connection.transaction(async (transaction) => {
        const user = await User.findOneAndUpdate(
          { email, ...eligible },
          { $inc: { __v: 1 } },
          { session: transaction, timestamps: false, returnDocument: 'after' },
        );
        if (!user) return null;
        await PasswordResetToken.deleteMany(
          { userId: user._id, usedAt: null },
          { session: transaction },
        );
        const [created] = await PasswordResetToken.create(
          [
            {
              userId: user._id,
              tokenHash: token.hash,
              expiresAt: token.expiresAt,
            },
          ],
          { session: transaction },
        );
        if (!created) throw new Error('Token creation failed');
        await appendRecoveryAudit(
          {
            action: 'AUTH_PASSWORD_RESET_REQUESTED',
            userId: user._id,
            requestId,
          },
          transaction,
        );
        return {
          email: user.email,
          firstName: user.firstName,
          tokenId: String(created._id),
        };
      });
    }),
  checkReset: (hash, now) =>
    safe(async () => {
      const token = await PasswordResetToken.findOne({
        tokenHash: hash,
        usedAt: null,
        expiresAt: { $gt: now() },
      });
      if (!token || !(await User.exists({ _id: token.userId, ...eligible })))
        throw invalidResetToken();
    }),
  reset: (hash, passwordHash, requestId, now) =>
    safe(() =>
      mongoose.connection.transaction(async (transaction) => {
        const timestamp = now();
        const token = await PasswordResetToken.findOne({
          tokenHash: hash,
          usedAt: null,
          expiresAt: { $gt: timestamp },
        }).session(transaction);
        if (!token) throw invalidResetToken();
        const user = await User.findOneAndUpdate(
          { _id: token.userId, ...eligible },
          { $set: { passwordHash }, $inc: { __v: 1 } },
          {
            session: transaction,
            runValidators: true,
            returnDocument: 'after',
          },
        );
        if (!user) throw invalidResetToken();
        const consumed = await PasswordResetToken.updateOne(
          { _id: token._id, usedAt: null, expiresAt: { $gt: now() } },
          { $set: { usedAt: timestamp } },
          { session: transaction, runValidators: true },
        );
        if (consumed.modifiedCount !== 1) throw invalidResetToken();
        await PasswordResetToken.updateMany(
          { userId: user._id, usedAt: null },
          { $set: { usedAt: timestamp } },
          { session: transaction, runValidators: true },
        );
        const revoked = await Session.updateMany(
          { userId: user._id, revokedAt: null },
          {
            $set: { revokedAt: timestamp, revocationReason: 'PASSWORD_RESET' },
          },
          { session: transaction, runValidators: true },
        );
        await appendRecoveryAudit(
          {
            action: 'AUTH_PASSWORD_RESET',
            userId: user._id,
            revokedSessions: revoked.modifiedCount,
            requestId,
          },
          transaction,
        );
        return {
          email: user.email,
          firstName: user.firstName,
          tokenId: String(token._id),
        };
      }),
    ),
  current: (userId, sessionId, now) =>
    safe(async () => {
      if (!(await Session.exists(live(userId, sessionId, now()))))
        throw invalidSession();
      const user = await User.findById(userId).select('+passwordHash');
      if (!user) throw invalidSession();
      if (user.status === 'DISABLED')
        throw new AppError(403, 'AUTH_ACCOUNT_DISABLED', 'Account is disabled');
      if (user.status === 'SUSPENDED')
        throw new AppError(
          403,
          'AUTH_ACCOUNT_SUSPENDED',
          'Account is suspended',
        );
      if (user.status !== 'ACTIVE' || !user.emailVerifiedAt)
        throw new AppError(
          403,
          'AUTH_EMAIL_NOT_VERIFIED',
          'Verify your email before continuing',
        );
      if (!user.passwordHash)
        throw new AppError(
          400,
          'AUTH_PASSWORD_NOT_CONFIGURED',
          'Password is not configured',
        );
      return user.passwordHash;
    }),
  change: (input, now) =>
    safe(async () => {
      await mongoose.connection.transaction(async (transaction) => {
        const timestamp = now();
        const user = await User.findOneAndUpdate(
          { _id: input.userId, ...eligible, passwordHash: input.oldHash },
          { $set: { passwordHash: input.newHash }, $inc: { __v: 1 } },
          {
            session: transaction,
            runValidators: true,
            returnDocument: 'after',
          },
        );
        if (!user) throw currentPasswordInvalid();
        // Write-conflict with logout/refresh so an already revoked session cannot authorize a change.
        const current = await Session.updateOne(
          live(input.userId, input.sessionId, now()),
          { $inc: { __v: 1 } },
          { session: transaction },
        );
        if (current.modifiedCount !== 1) throw invalidSession();
        await PasswordResetToken.deleteMany(
          { userId: user._id, usedAt: null },
          { session: transaction },
        );
        const revoked = await Session.updateMany(
          {
            userId: user._id,
            _id: { $ne: new Types.ObjectId(input.sessionId) },
            revokedAt: null,
          },
          {
            $set: {
              revokedAt: timestamp,
              revocationReason: 'PASSWORD_CHANGED',
            },
          },
          { session: transaction, runValidators: true },
        );
        await appendRecoveryAudit(
          {
            action: 'AUTH_PASSWORD_CHANGED',
            userId: user._id,
            sessionId: new Types.ObjectId(input.sessionId),
            revokedSessions: revoked.modifiedCount,
            requestId: input.requestId,
          },
          transaction,
        );
      });
    }),
};
