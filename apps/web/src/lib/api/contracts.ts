import { z } from 'zod';

const id = z.string().regex(/^[a-f0-9]{24}$/i);
const profile = z.object({
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  learningGoals: z.array(
    z.enum([
      'LEARN_FROM_SCRATCH',
      'INTERVIEW_PREPARATION',
      'QUICK_REVISION',
      'MASTER_TECHNOLOGY',
      'STRENGTHEN_WEAK_AREAS',
    ]),
  ),
  interestedTechnologyIds: z.array(id),
  preferredDifficulty: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'])
    .optional(),
  dailyStudyGoalMinutes: z.number().int().min(5).max(240).optional(),
});
export const currentUserSchema = z.object({
  id,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
  emailVerified: z.boolean(),
  role: z.enum(['STUDENT', 'ADMIN']),
  plan: z.enum(['FREE', 'PREMIUM']),
  status: z.enum(['ACTIVE', 'PENDING_VERIFICATION', 'DISABLED', 'SUSPENDED']),
  authMethods: z.array(z.enum(['PASSWORD', 'GOOGLE'])),
  profile: profile.nullable(),
  createdAt: z.iso.datetime(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;
export const onboardingProfileSchema = z.strictObject({
  experienceLevel: profile.shape.experienceLevel.unwrap(),
  learningGoals: profile.shape.learningGoals
    .min(1)
    .max(5)
    .refine(
      (values) => new Set(values).size === values.length,
      'Choose unique learning goals',
    ),
  preferredDifficulty: profile.shape.preferredDifficulty.unwrap(),
  dailyStudyGoalMinutes: profile.shape.dailyStudyGoalMinutes.unwrap(),
});
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;
export const accessSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.literal(900),
});
export function envelope<T extends z.ZodType>(data: T) {
  return z.object({ success: z.literal(true), data });
}
export const logoutSchema = z.null();
