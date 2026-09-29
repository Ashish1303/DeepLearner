import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { User } from '../users/user.model.js';
import { EmailVerificationToken } from './email-verification-token.model.js';
import { appendAuthAudit } from '../audit/audit.repository.js';
import type { RegistrationInput } from './auth.schema.js';

export interface TokenRecordInput {
  hash: string;
  expiresAt: Date;
}
export interface RegisteredAccount {
  userId: string;
  email: string;
  firstName: string;
  tokenId: string;
}
export interface RegistrationRepository {
  register(
    input: Omit<RegistrationInput, 'password'> & { passwordHash: string },
    token: TokenRecordInput,
    requestId: string,
  ): Promise<RegisteredAccount>;
  verify(hash: string, requestId: string, now: () => Date): Promise<void>;
  resend(
    email: string,
    token: TokenRecordInput,
  ): Promise<RegisteredAccount | null>;
}
const invalidToken = () =>
  new AppError(
    400,
    'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED',
    'Verification token is invalid or expired',
  );

async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000 &&
      error.keyPattern?.email === 1
    ) {
      throw new AppError(
        409,
        'AUTH_EMAIL_ALREADY_EXISTS',
        'An account with this email already exists',
      );
    }
    throw new AppError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Registration service is temporarily unavailable',
    );
  }
}

// Read-only prerequisite check. Provisioning is a separate, explicitly approved operation.
async function requireUniqueIndexes() {
  for (const [collection, field] of [
    [User.collection, 'email'],
    [EmailVerificationToken.collection, 'tokenHash'],
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
    ) {
      throw new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Registration service is temporarily unavailable',
      );
    }
  }
}

export const registrationRepository: RegistrationRepository = {
  register: (input, token, requestId) =>
    safe(async () => {
      await requireUniqueIndexes();
      return mongoose.connection.transaction(async (session) => {
        if (await User.exists({ email: input.email }).session(session))
          throw new AppError(
            409,
            'AUTH_EMAIL_ALREADY_EXISTS',
            'An account with this email already exists',
          );
        const user = new User({
          ...input,
          role: 'STUDENT',
          plan: 'FREE',
          status: 'PENDING_VERIFICATION',
          emailVerifiedAt: null,
        });
        await user.save({ session });
        const verification = new EmailVerificationToken({
          userId: user._id,
          tokenHash: token.hash,
          expiresAt: token.expiresAt,
        });
        await verification.save({ session });
        await appendAuthAudit('AUTH_REGISTERED', user._id, requestId, session);
        return {
          userId: String(user._id),
          email: user.email,
          firstName: user.firstName,
          tokenId: String(verification._id),
        };
      });
    }),
  verify: (hash, requestId, now) =>
    safe(async () => {
      await mongoose.connection.transaction(async (session) => {
        const timestamp = now();
        const token = await EmailVerificationToken.findOne({
          tokenHash: hash,
          usedAt: null,
          expiresAt: { $gt: timestamp },
        }).session(session);
        if (!token) throw invalidToken();
        // This write conflicts with resends even when no outstanding token existed at their snapshot.
        const user = await User.findOneAndUpdate(
          {
            _id: token.userId,
            status: 'PENDING_VERIFICATION',
            emailVerifiedAt: null,
          },
          {
            $set: { status: 'ACTIVE', emailVerifiedAt: timestamp },
            $inc: { __v: 1 },
          },
          { session, runValidators: true, returnDocument: 'after' },
        );
        if (!user) throw invalidToken();
        const consumed = await EmailVerificationToken.updateOne(
          { _id: token._id, usedAt: null, expiresAt: { $gt: now() } },
          { $set: { usedAt: timestamp } },
          { session, runValidators: true },
        );
        if (consumed.modifiedCount !== 1) throw invalidToken();
        await EmailVerificationToken.updateMany(
          { userId: user._id, usedAt: null },
          { $set: { usedAt: timestamp } },
          { session, runValidators: true },
        );
        await appendAuthAudit(
          'AUTH_EMAIL_VERIFIED',
          user._id,
          requestId,
          session,
        );
      });
    }),
  resend: (email, token) =>
    safe(async () => {
      await requireUniqueIndexes();
      return mongoose.connection.transaction(async (session) => {
        const user = await User.findOneAndUpdate(
          { email, status: 'PENDING_VERIFICATION', emailVerifiedAt: null },
          { $inc: { __v: 1 } },
          { session, runValidators: true, returnDocument: 'after' },
        );
        if (!user) return null;
        // Delete old records rather than overloading usedAt with a false consumption event.
        await EmailVerificationToken.deleteMany(
          { userId: user._id, usedAt: null },
          { session },
        );
        const replacement = new EmailVerificationToken({
          userId: user._id,
          tokenHash: token.hash,
          expiresAt: token.expiresAt,
        });
        await replacement.save({ session });
        return {
          userId: String(user._id),
          firstName: user.firstName,
          email: user.email,
          tokenId: String(replacement._id),
        };
      });
    }),
};
