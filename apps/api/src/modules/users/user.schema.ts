import { z } from 'zod';

const unique = (values: string[]) => new Set(values).size === values.length;
const profile = z
  .strictObject({
    experienceLevel: z
      .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
      .optional(),
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
  })
  .refine((value) => Object.keys(value).length > 0);

export const profilePatch = z
  .strictObject({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    profile: profile.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
export type ProfilePatch = z.output<typeof profilePatch>;
export const profilePatchRequest = z.strictObject({
  body: profilePatch,
  params: z.strictObject({}),
  query: z.strictObject({}),
});
export const profileGetRequest = z.strictObject({
  body: z.strictObject({}).optional(),
  params: z.strictObject({}),
  query: z.strictObject({}),
});
export const profileFieldNames = [
  'firstName',
  'lastName',
  'profile.experienceLevel',
  'profile.learningGoals',
  'profile.interestedTechnologyIds',
  'profile.preferredDifficulty',
  'profile.dailyStudyGoalMinutes',
] as const;
export type ProfileField = (typeof profileFieldNames)[number];

export function profileUpdate(
  input: ProfilePatch,
): Partial<Record<ProfileField, unknown>> {
  const fields: Partial<Record<ProfileField, unknown>> = {};
  if (input.firstName !== undefined) fields.firstName = input.firstName;
  if (input.lastName !== undefined) fields.lastName = input.lastName;
  for (const key of profileFieldNames) {
    if (!key.startsWith('profile.')) continue;
    const leaf = key.slice(8) as keyof NonNullable<ProfilePatch['profile']>;
    if (input.profile?.[leaf] !== undefined) fields[key] = input.profile[leaf];
  }
  return fields;
}
