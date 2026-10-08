import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CurrentUser } from '../src/lib/api/contracts';
import {
  draftFromProfile,
  firstIncompleteStep,
  isOnboardingComplete,
  onboardingRedirect,
  profilePayload,
  validateDraft,
} from '../src/lib/onboarding/profile';
const profile = {
  experienceLevel: 'BEGINNER' as const,
  learningGoals: ['LEARN_FROM_SCRATCH' as const],
  preferredDifficulty: 'INTERMEDIATE' as const,
  dailyStudyGoalMinutes: 30,
  interestedTechnologyIds: [],
};
const user: CurrentUser = {
  id: 'a'.repeat(24),
  firstName: 'Test',
  lastName: 'Student',
  email: 'test@example.com',
  emailVerified: true,
  role: 'STUDENT',
  status: 'ACTIVE',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile,
  createdAt: '2026-10-07T00:00:00.000Z',
};
test('completion derives from exactly the four approved profile fields', () => {
  assert(isOnboardingComplete(profile));
  assert(!isOnboardingComplete(null));
  for (const patch of [
    { experienceLevel: undefined },
    { preferredDifficulty: undefined },
    { learningGoals: [] },
    { learningGoals: ['LEARN_FROM_SCRATCH', 'LEARN_FROM_SCRATCH'] },
    { dailyStudyGoalMinutes: 4 },
    { dailyStudyGoalMinutes: 241 },
    { dailyStudyGoalMinutes: 5.5 },
    { dailyStudyGoalMinutes: undefined },
  ])
    assert(
      !isOnboardingComplete({ ...profile, ...patch } as CurrentUser['profile']),
    );
  for (const minutes of [5, 240])
    assert(
      isOnboardingComplete({ ...profile, dailyStudyGoalMinutes: minutes }),
    );
});
test('saved partial values resume at the first incomplete step without defaults', () => {
  const empty = draftFromProfile(null);
  assert.deepEqual(empty, {
    experienceLevel: '',
    learningGoals: [],
    preferredDifficulty: '',
    dailyStudyGoalMinutes: '',
  });
  assert.equal(firstIncompleteStep(empty), 0);
  const draft = draftFromProfile(profile);
  assert.equal(firstIncompleteStep(draft), 3);
  assert.equal(firstIncompleteStep({ ...draft, learningGoals: [] }), 1);
  assert.equal(firstIncompleteStep({ ...draft, dailyStudyGoalMinutes: '' }), 2);
  draft.learningGoals.push('QUICK_REVISION');
  assert.equal(profile.learningGoals.length, 1);
});
test('client validation and payload reject extras and never send technology IDs', () => {
  const { profile: valid } = validateDraft(draftFromProfile(profile));
  assert(valid);
  assert.deepEqual(Object.keys(profilePayload(valid).profile).sort(), [
    'dailyStudyGoalMinutes',
    'experienceLevel',
    'learningGoals',
    'preferredDifficulty',
  ]);
  assert.throws(() =>
    profilePayload({ ...valid, interestedTechnologyIds: [] } as typeof valid),
  );
  for (const value of ['', ' ', 'abc', 'Infinity', '30.5', '0', '241'])
    assert(
      validateDraft({
        ...draftFromProfile(profile),
        dailyStudyGoalMinutes: value,
      }).errors.dailyStudyGoalMinutes,
    );
});
test('only eligible students are gated; complete and incomplete routes cannot loop', () => {
  assert.equal(onboardingRedirect(user, '/onboarding'), '/dashboard');
  assert.equal(onboardingRedirect(user, '/dashboard'), null);
  const incomplete = { ...user, profile: null };
  assert.equal(onboardingRedirect(incomplete, '/dashboard'), '/onboarding');
  assert.equal(onboardingRedirect(incomplete, '/onboarding'), null);
  for (const patch of [
    { role: 'ADMIN' as const },
    { status: 'DISABLED' as const },
    { status: 'SUSPENDED' as const },
    { status: 'PENDING_VERIFICATION' as const },
    { emailVerified: false },
  ]) {
    assert.equal(
      onboardingRedirect({ ...incomplete, ...patch }, '/dashboard'),
      null,
    );
  }
  assert.equal(onboardingRedirect(null, '/dashboard'), null);
  assert.equal(onboardingRedirect(incomplete, '//external.example'), null);
});
