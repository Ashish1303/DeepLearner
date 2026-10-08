import {
  onboardingProfileSchema,
  type CurrentUser,
  type OnboardingProfile,
} from '../api/contracts';

export const experienceOptions = [
  'BEGINNER',
  'INTERMEDIATE',
  'ADVANCED',
] as const;
export const difficultyOptions = [
  ...experienceOptions,
  'INTERVIEW_READY',
] as const;
export const goalOptions = [
  'LEARN_FROM_SCRATCH',
  'INTERVIEW_PREPARATION',
  'QUICK_REVISION',
  'MASTER_TECHNOLOGY',
  'STRENGTHEN_WEAK_AREAS',
] as const;
export const labels: Record<string, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  INTERVIEW_READY: 'Interview ready',
  LEARN_FROM_SCRATCH: 'Learn from scratch',
  INTERVIEW_PREPARATION: 'Interview preparation',
  QUICK_REVISION: 'Quick revision',
  MASTER_TECHNOLOGY: 'Master a technology',
  STRENGTHEN_WEAK_AREAS: 'Strengthen weak areas',
};
export type OnboardingDraft = {
  experienceLevel: string;
  learningGoals: string[];
  preferredDifficulty: string;
  dailyStudyGoalMinutes: string;
};
export type Field = keyof OnboardingDraft;
export function draftFromProfile(
  profile: CurrentUser['profile'],
): OnboardingDraft {
  return {
    experienceLevel: profile?.experienceLevel ?? '',
    learningGoals: [...(profile?.learningGoals ?? [])],
    preferredDifficulty: profile?.preferredDifficulty ?? '',
    dailyStudyGoalMinutes:
      profile?.dailyStudyGoalMinutes === undefined
        ? ''
        : String(profile.dailyStudyGoalMinutes),
  };
}
export function validateDraft(draft: OnboardingDraft) {
  const result = onboardingProfileSchema.safeParse({
    ...draft,
    dailyStudyGoalMinutes: draft.dailyStudyGoalMinutes.trim()
      ? Number(draft.dailyStudyGoalMinutes)
      : NaN,
  });
  const errors: Partial<Record<Field, string>> = {};
  const messages: Record<Field, string> = {
    experienceLevel: 'Choose your experience level.',
    learningGoals: 'Choose 1–5 different learning goals.',
    preferredDifficulty: 'Choose your preferred difficulty.',
    dailyStudyGoalMinutes: 'Enter a whole number from 5 to 240 minutes.',
  };
  if (!result.success)
    for (const issue of result.error.issues) {
      const field = issue.path[0] as Field;
      if (Object.hasOwn(messages, field)) errors[field] = messages[field];
    }
  return { errors, profile: result.success ? result.data : undefined };
}
export function isOnboardingComplete(profile: CurrentUser['profile']): boolean {
  if (!profile) return false;
  // Only the completion fields count; preserve existing technology IDs separately.
  const {
    experienceLevel,
    learningGoals,
    preferredDifficulty,
    dailyStudyGoalMinutes,
  } = profile;
  return onboardingProfileSchema.safeParse({
    experienceLevel,
    learningGoals,
    preferredDifficulty,
    dailyStudyGoalMinutes,
  }).success;
}
export function onboardingRedirect(
  user: CurrentUser | null,
  path: string,
): '/onboarding' | '/dashboard' | null {
  if (
    !user ||
    user.role !== 'STUDENT' ||
    user.status !== 'ACTIVE' ||
    !user.emailVerified
  )
    return null;
  const complete = isOnboardingComplete(user.profile);
  if (path === '/dashboard' && !complete) return '/onboarding';
  if (path === '/onboarding' && complete) return '/dashboard';
  return null;
}
export const stepFields: readonly (readonly Field[])[] = [
  ['experienceLevel'],
  ['learningGoals'],
  ['preferredDifficulty', 'dailyStudyGoalMinutes'],
];
export function firstIncompleteStep(draft: OnboardingDraft): number {
  const { errors } = validateDraft(draft);
  const step = stepFields.findIndex((fields) =>
    fields.some((field) => errors[field]),
  );
  return step === -1 ? 3 : step;
}
export function profilePayload(profile: OnboardingProfile) {
  // Runtime validation prevents accidental extra fields from reaching PATCH.
  return { profile: onboardingProfileSchema.parse(profile) };
}
