import { z } from 'zod';

export const normalizedEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());
const unique = (values: string[]) => new Set(values).size === values.length;
const profile = z.strictObject({
  experienceLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
  learningGoals: z
    .array(
      z.enum([
        'LEARN_FROM_SCRATCH',
        'INTERVIEW_PREPARATION',
        'QUICK_REVISION',
        'MASTER_TECHNOLOGY',
        'STRENGTHEN_WEAK_AREAS',
      ]),
    )
    .max(5)
    .refine(unique)
    .optional(),
  interestedTechnologyIds: z
    .array(
      z
        .string()
        .regex(/^[a-fA-F0-9]{24}$/)
        .toLowerCase(),
    )
    .max(50)
    .refine(unique)
    .optional(),
  preferredDifficulty: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'])
    .optional(),
  dailyStudyGoalMinutes: z.number().int().min(5).max(240).optional(),
});
export const registrationBody = z.strictObject({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: normalizedEmail,
  password: z.string().min(10).max(128),
  profile: profile.optional(),
});
export const verificationBody = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const resendBody = z.strictObject({ email: normalizedEmail });
function request<S extends z.ZodType>(body: S) {
  return z.strictObject({
    body,
    params: z.strictObject({}),
    query: z.strictObject({}),
  });
}
export const registrationRequest = request(registrationBody);
export const verificationRequest = request(verificationBody);
export const resendRequest = request(resendBody);
export type RegistrationInput = z.output<typeof registrationBody>;
