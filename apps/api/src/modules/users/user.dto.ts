import type { Types } from 'mongoose';
import type { UserRecord } from './user.model.js';

export type ProjectedUser = Pick<
  UserRecord,
  'firstName' | 'lastName' | 'email' | 'role' | 'plan' | 'status' | 'profile'
> & {
  _id: Types.ObjectId;
  createdAt: Date;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
};
export function userDto(user: ProjectedUser) {
  const p = user.profile;
  const authMethods: ('PASSWORD' | 'GOOGLE')[] = [];
  if (user.hasPassword) authMethods.push('PASSWORD');
  if (user.hasGoogle) authMethods.push('GOOGLE');
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    plan: user.plan,
    status: user.status,
    authMethods,
    profile:
      p == null
        ? null
        : {
            ...(p.experienceLevel !== undefined
              ? { experienceLevel: p.experienceLevel }
              : {}),
            learningGoals: [...(p.learningGoals ?? [])],
            interestedTechnologyIds: (p.interestedTechnologyIds ?? []).map(
              String,
            ),
            ...(p.preferredDifficulty !== undefined
              ? { preferredDifficulty: p.preferredDifficulty }
              : {}),
            ...(p.dailyStudyGoalMinutes !== undefined
              ? { dailyStudyGoalMinutes: p.dailyStudyGoalMinutes }
              : {}),
          },
    createdAt: user.createdAt.toISOString(),
  };
}
export type UserDto = ReturnType<typeof userDto>;
