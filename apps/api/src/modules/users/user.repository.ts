import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { User } from './user.model.js';
import { type ProjectedUser, userDto, type UserDto } from './user.dto.js';
import {
  profileUpdate,
  type ProfilePatch,
  type ProfileField,
} from './user.schema.js';
import { appendProfileAudit } from '../audit/audit.repository.js';

// Compute capabilities inside MongoDB; credential material never leaves this projection.
const projection = {
  _id: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  role: 1,
  plan: 1,
  status: 1,
  profile: 1,
  createdAt: 1,
  emailVerified: { $ne: [{ $ifNull: ['$emailVerifiedAt', null] }, null] },
  hasPassword: {
    $and: [
      { $eq: [{ $type: '$passwordHash' }, 'string'] },
      { $ne: ['$passwordHash', ''] },
    ],
  },
  hasGoogle: { $in: ['GOOGLE', { $ifNull: ['$authProviders.provider', []] }] },
};
async function read(id: Types.ObjectId, session?: ClientSession) {
  const query = User.aggregate<ProjectedUser>([
    { $match: { _id: id } },
    { $project: projection },
  ]);
  if (session) query.session(session);
  const [user] = await query.exec();
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  if (user.status === 'DISABLED')
    throw new AppError(403, 'AUTH_ACCOUNT_DISABLED', 'Account is disabled');
  if (user.status === 'SUSPENDED')
    throw new AppError(403, 'AUTH_ACCOUNT_SUSPENDED', 'Account is suspended');
  if (user.status !== 'ACTIVE' || !user.emailVerified)
    throw new AppError(
      403,
      'AUTH_EMAIL_NOT_VERIFIED',
      'Verify your email before continuing',
    );
  return user;
}
async function safe<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Profile service is temporarily unavailable',
    );
  }
}
export interface UserRepository {
  get(userId: string): Promise<UserDto>;
  patch(
    userId: string,
    input: ProfilePatch,
    requestId: string,
  ): Promise<UserDto>;
}
export const userRepository: UserRepository = {
  get: (userId) =>
    safe(async () => userDto(await read(new Types.ObjectId(userId)))),
  patch: (userId, input, requestId) =>
    safe(async () => {
      const id = new Types.ObjectId(userId);
      const session = await mongoose.connection.startSession();
      try {
        return await session.withTransaction(async () => {
          await read(id, session);
          const fields = profileUpdate(input);
          const result = await User.updateOne(
            { _id: id, status: 'ACTIVE', emailVerifiedAt: { $ne: null } },
            { $set: fields, $inc: { __v: 1 } },
            { session, runValidators: true },
          );
          if (result.modifiedCount !== 1)
            throw new AppError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Profile update unavailable',
            );
          await appendProfileAudit(
            {
              userId: id,
              requestId,
              changedFields: Object.keys(fields).sort() as ProfileField[],
            },
            session,
          );
          return userDto(await read(id, session));
        });
      } finally {
        await session.endSession();
      }
    }),
};
