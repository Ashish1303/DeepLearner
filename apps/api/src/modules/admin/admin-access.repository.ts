import { Types } from 'mongoose';
import { AppError } from '../../common/errors/app-error.js';
import { mongoose } from '../../config/database.js';
import { User } from '../users/user.model.js';

export const adminReadBudgetMs = 5000;
export const adminUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Admin authorization is temporarily unavailable',
  );
export interface AdminRead {
  timeoutMS: number;
  signal: AbortSignal;
}
export interface AdminAccessRepository {
  read(userId: string, options: AdminRead): Promise<unknown>;
}

/** Read-only, primary account lookup. Importing never connects or provisions. */
export const adminAccessRepository: AdminAccessRepository = {
  async read(userId, options) {
    try {
      if (
        !/^[a-f0-9]{24}$/.test(userId) ||
        !Number.isSafeInteger(options.timeoutMS) ||
        options.timeoutMS < 1 ||
        options.timeoutMS > adminReadBudgetMs ||
        options.signal.aborted ||
        mongoose.connection.readyState !== 1 ||
        !mongoose.connection.db
      )
        throw adminUnavailable();
      return await mongoose.connection.db
        .collection(User.collection.name)
        .findOne(
          { _id: new Types.ObjectId(userId) },
          {
            projection: { _id: 1, role: 1, status: 1, emailVerifiedAt: 1 },
            readPreference: 'primary',
            timeoutMS: options.timeoutMS,
            maxTimeMS: options.timeoutMS,
            signal: options.signal,
          },
        );
    } catch {
      throw adminUnavailable();
    }
  },
};
