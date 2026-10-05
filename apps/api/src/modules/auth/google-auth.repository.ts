import { Types } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { User } from '../users/user.model.js';
import { Session } from './session.model.js';
import { appendGoogleAudit } from '../audit/audit.repository.js';
import type { GoogleIdentity } from './google-identity.service.js';
import { googleUnavailable } from './google-identity.service.js';
import type { AuthContext } from './access-token.service.js';
import {
  requireEligible,
  safeUser,
  type LoginAccount,
} from './login.repository.js';

export const linkingNotAllowed = () =>
  new AppError(
    403,
    'AUTH_GOOGLE_LINKING_NOT_ALLOWED',
    'Google account linking is not allowed',
  );
export interface GoogleAuthRepository {
  login(
    input: {
      identity: GoogleIdentity;
      sessionId: string;
      hash: string;
      expiresAt: Date;
      requestId: string;
      userAgent: string;
    },
    sign: (context: AuthContext) => Promise<string>,
    now: () => Date,
  ): Promise<{
    created: boolean;
    accessToken: string;
    user: ReturnType<typeof safeUser>;
  }>;
}
async function prerequisites() {
  const userIndexes = await User.collection.listIndexes().toArray();
  const sessionIndexes = await Session.collection.listIndexes().toArray();
  const plainUnique = (indexes: typeof userIndexes, field: string) =>
    indexes.some(
      (index) =>
        index.unique === true &&
        index.key[field] === 1 &&
        Object.keys(index.key).length === 1 &&
        !index.sparse &&
        !index.partialFilterExpression,
    );
  const provider = userIndexes.some(
    (index) =>
      index.unique === true &&
      !index.sparse &&
      index.key['authProviders.provider'] === 1 &&
      index.key['authProviders.providerUserId'] === 1 &&
      Object.keys(index.key).length === 2 &&
      JSON.stringify(index.partialFilterExpression) ===
        JSON.stringify({ 'authProviders.providerUserId': { $type: 'string' } }),
  );
  if (
    !plainUnique(userIndexes, 'email') ||
    !provider ||
    !plainUnique(sessionIndexes, 'refreshTokenHash')
  )
    throw googleUnavailable();
}
export const googleAuthRepository: GoogleAuthRepository = {
  async login(input, sign, now) {
    try {
      await prerequisites();
      for (let attempt = 0; attempt < 2; attempt++) {
        const transaction = await mongoose.connection.startSession();
        try {
          return await transaction.withTransaction(async () => {
            const { identity } = input;
            const timestamp = now();
            if (input.expiresAt <= timestamp) throw googleUnavailable();
            let user = await User.findOne({
              authProviders: {
                $elemMatch: {
                  provider: 'GOOGLE',
                  providerUserId: identity.subject,
                },
              },
            })
              .select('+authProviders')
              .session(transaction);
            const bySubject = Boolean(user);
            if (!user)
              user = await User.findOne({ email: identity.email })
                .select('+authProviders')
                .session(transaction);
            let created = false,
              linked = false;
            if (!user) {
              const validName = (name: string | undefined): name is string =>
                Boolean(name && name.trim().length > 0 && name.length <= 80);
              if (
                !validName(identity.firstName) ||
                !validName(identity.lastName)
              )
                throw new AppError(
                  400,
                  'AUTH_GOOGLE_PROFILE_INCOMPLETE',
                  'Google profile requires first and last names',
                );
              const records = await User.create(
                [
                  {
                    email: identity.email,
                    firstName: identity.firstName,
                    lastName: identity.lastName,
                    role: 'STUDENT',
                    plan: 'FREE',
                    status: 'ACTIVE',
                    emailVerifiedAt: timestamp,
                    passwordHash: null,
                    authProviders: [
                      { provider: 'GOOGLE', providerUserId: identity.subject },
                    ],
                    lastLoginAt: timestamp,
                  },
                ],
                { session: transaction },
              );
              user = records[0] ?? null;
              if (!user) throw googleUnavailable();
              created = true;
            }
            if (user.status === 'DISABLED')
              throw new AppError(
                403,
                'AUTH_ACCOUNT_DISABLED',
                'Account is disabled',
              );
            if (user.status === 'PENDING_VERIFICATION' || !user.emailVerifiedAt)
              throw linkingNotAllowed();
            const account: LoginAccount = {
              id: String(user._id),
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              plan: user.plan,
              status: user.status,
              emailVerifiedAt: user.emailVerifiedAt,
              suspendedUntil: user.suspendedUntil ?? null,
              passwordHash: null,
            };
            const reactivated = requireEligible(account, timestamp);
            if (!created && !bySubject) {
              if (
                !identity.authoritative ||
                user.authProviders.some(
                  (provider) => provider.provider === 'GOOGLE',
                )
              )
                throw linkingNotAllowed();
              linked = true;
            }
            if (!created) {
              const updated = await User.updateOne(
                {
                  _id: user._id,
                  status: user.status,
                  ...(reactivated
                    ? { suspendedUntil: { $lte: timestamp } }
                    : {}),
                },
                {
                  $set: {
                    lastLoginAt: timestamp,
                    ...(reactivated ? { status: 'ACTIVE' } : {}),
                    ...(linked
                      ? {
                          authProviders: [
                            ...user.authProviders.map((provider) => ({
                              provider: provider.provider,
                              providerUserId: provider.providerUserId,
                            })),
                            {
                              provider: 'GOOGLE',
                              providerUserId: identity.subject,
                            },
                          ],
                        }
                      : {}),
                  },
                  $inc: { __v: 1 },
                },
                { session: transaction, runValidators: true },
              );
              if (updated.modifiedCount !== 1) throw linkingNotAllowed();
            }
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
              { session: transaction },
            );
            if (linked)
              await appendGoogleAudit(
                {
                  action: 'AUTH_PROVIDER_LINKED',
                  userId: user._id,
                  requestId: input.requestId,
                },
                transaction,
              );
            await appendGoogleAudit(
              {
                action: 'AUTH_GOOGLE_LOGIN',
                userId: user._id,
                requestId: input.requestId,
                sessionId,
                reactivatedFromExpiredSuspension: reactivated,
              },
              transaction,
            );
            return { created, accessToken, user: safeUser(account) };
          });
        } catch (error) {
          // A single re-resolution handles a competing registration/link commit; no blind merging.
          if (
            attempt === 0 &&
            error instanceof mongoose.mongo.MongoServerError &&
            error.code === 11000 &&
            (error.keyPattern?.email === 1 ||
              error.keyPattern?.['authProviders.providerUserId'] === 1)
          )
            continue;
          throw error;
        } finally {
          await transaction.endSession();
        }
      }
      throw googleUnavailable();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw googleUnavailable();
    }
  },
};
