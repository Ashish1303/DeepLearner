import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { mongoose } from '../../config/database.js';
import { User } from '../users/user.model.js';
import { appendLogoutAudit } from '../audit/audit.repository.js';
import { Session } from './session.model.js';
import { matchesRefreshHash } from './refresh-token.service.js';

export interface LogoutRepository {
  logout(
    input: { sessionId: string; hash: string; requestId: string },
    now: () => Date,
  ): Promise<void>;
  logoutAll(
    input: { userId: string; requestId: string },
    now: () => Date,
  ): Promise<number>;
}

async function safe<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new AppError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Authentication service is temporarily unavailable',
    );
  }
}

export const logoutRepository: LogoutRepository = {
  logout: (input, now) =>
    safe(async () => {
      await mongoose.connection.transaction(async (transaction) => {
        const current = await Session.findById(input.sessionId)
          .select('+refreshTokenHash')
          .session(transaction);
        if (
          !current ||
          current.revokedAt ||
          !matchesRefreshHash(input.hash, current.refreshTokenHash)
        )
          return;
        const changed = await Session.updateOne(
          { _id: current._id, refreshTokenHash: input.hash, revokedAt: null },
          { $set: { revokedAt: now(), revocationReason: 'LOGOUT' } },
          { session: transaction, runValidators: true },
        );
        if (changed.modifiedCount !== 1)
          throw new Error('Session transition failed');
        await appendLogoutAudit(
          {
            action: 'AUTH_LOGOUT',
            userId: current.userId,
            sessionId: current._id,
            requestId: input.requestId,
          },
          transaction,
        );
      });
    }),
  logoutAll: (input, now) =>
    safe(() =>
      mongoose.connection.transaction(async (transaction) => {
        const userId = new Types.ObjectId(input.userId);
        // Serialize with F008 login/refresh without changing account eligibility or profile.
        await User.updateOne(
          { _id: userId },
          { $inc: { __v: 1 } },
          { session: transaction, timestamps: false },
        );
        const timestamp = now();
        const changed = await Session.updateMany(
          { userId, revokedAt: null, expiresAt: { $gt: timestamp } },
          { $set: { revokedAt: timestamp, revocationReason: 'LOGOUT_ALL' } },
          { session: transaction, runValidators: true },
        );
        await appendLogoutAudit(
          {
            action: 'AUTH_LOGOUT_ALL',
            userId,
            revokedSessions: changed.modifiedCount,
            requestId: input.requestId,
          },
          transaction,
        );
        return changed.modifiedCount;
      }),
    ),
};
