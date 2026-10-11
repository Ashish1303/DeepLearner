import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  learningRoute,
  validId,
  isLearningRoute,
} from '../src/lib/learning-paths/routes';
import { onboardingRedirect } from '../src/lib/onboarding/profile';
import type { CurrentUser } from '../src/lib/api/contracts';
test('fixed route builders reject invalid IDs and normalize safe IDs', () => {
  for (const resource of ['technology', 'path', 'module', 'topic'] as const) {
    assert(isLearningRoute(learningRoute(resource, 'A'.repeat(24))));
    assert(learningRoute(resource, 'A'.repeat(24)).includes('a'.repeat(24)));
    for (const id of ['../', 'a'.repeat(24) + '\n', '', 'https://other.test']) {
      assert(!validId(id));
      assert.throws(() => learningRoute(resource, id));
    }
  }
});
test('hierarchy browsing leaves existing incomplete-student dashboard gate unchanged', () => {
  const user = {
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
    profile: null,
  } as CurrentUser;
  for (const resource of ['technology', 'path', 'module', 'topic'] as const)
    assert.equal(
      onboardingRedirect(user, learningRoute(resource, 'a'.repeat(24))),
      null,
    );
  assert.equal(onboardingRedirect(user, '/dashboard'), '/onboarding');
});
