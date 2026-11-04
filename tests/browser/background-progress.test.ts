import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backgroundProgress, backgroundStudent } from './background-progress';
import { progressEnvelope } from '../../apps/web/src/lib/progress/contracts';
import { completionView } from '../../apps/web/src/lib/progress/completion-contracts';
import { dashboardEnvelope } from '../../apps/web/src/lib/dashboard/contracts';
const base = 'http://127.0.0.1:4000/api/v1/';
const id = 'a'.repeat(24);
test('exact healthy empty dashboard read obeys production schema', async () => {
  const route = fixture();
  assert.equal(
    await backgroundProgress(route, new URL(base + 'dashboard?limit=5'), true),
    true,
  );
  assert.equal(
    dashboardEnvelope.parse(JSON.parse(route.responses[0]!.body)).data.items
      .length,
    0,
  );
  for (const [method, suffix, eligible] of [
    ['POST', '?limit=5', true],
    ['GET', '?after=bad', true],
    ['GET', '?limit=5', false],
    ['GET', '', true],
    ['GET', '?limit=5&cursor=bad', true],
  ] as const) {
    const rejected = fixture(method);
    assert.equal(
      await backgroundProgress(
        rejected,
        new URL(base + 'dashboard' + suffix),
        eligible,
      ),
      false,
    );
    assert.equal(rejected.responses.length, 0);
  }
});
function fixture(
  method = 'GET',
  headers: Record<string, string> = {
    authorization: 'Bearer synthetic-test-token',
  },
) {
  const responses: { status: number; body: string }[] = [];
  return {
    responses,
    request: () => ({ method: () => method, allHeaders: async () => headers }),
    fulfill: async (response: { status: number; body: string }) => {
      responses.push(response);
    },
  };
}
for (const path of ['progress', 'progress/completion'])
  test('exact read fixture obeys production schema: ' + path, async () => {
    const route = fixture();
    assert.equal(
      await backgroundProgress(
        route,
        new URL(base + path + '?conceptId=' + id),
        true,
      ),
      true,
    );
    assert.equal(route.responses.length, 1);
    const body = JSON.parse(route.responses[0]!.body);
    if (path === 'progress')
      assert.equal(progressEnvelope.parse(body).data.attemptCount, 0);
    else {
      const data = completionView.parse(body.data);
      assert.equal(data.eligibility, 'INELIGIBLE');
      assert.equal(data.completion.status, 'NOT_COMPLETED');
    }
  });
for (const [name, url, method, headers] of [
  [
    'unknown endpoint',
    base + 'progress/other?conceptId=' + id,
    'GET',
    undefined,
  ],
  [
    'wrong origin',
    'http://127.0.0.1:4101/api/v1/progress?conceptId=' + id,
    'GET',
    undefined,
  ],
  ['write', base + 'progress?conceptId=' + id, 'POST', undefined],
  [
    'extra query',
    base + 'progress?conceptId=' + id + '&page=1',
    'GET',
    undefined,
  ],
  ['malformed id', base + 'progress?conceptId=bad', 'GET', undefined],
  ['missing auth', base + 'progress?conceptId=' + id, 'GET', {}],
  [
    'cookie',
    base + 'progress?conceptId=' + id,
    'GET',
    { authorization: 'Bearer synthetic-test-token', cookie: 'synthetic' },
  ],
] as const)
  test('background fixture refuses ' + name, async () => {
    const route = fixture(method, headers);
    assert.equal(await backgroundProgress(route, new URL(url), true), false);
    assert.equal(route.responses.length, 0);
  });
test('completion-only fixture never replaces F037 progress', async () => {
  assert.equal(
    await backgroundProgress(
      fixture(),
      new URL(base + 'progress?conceptId=' + id),
      true,
      true,
    ),
    false,
  );
});

for (const [role, status, emailVerified, session] of [
  ['ADMIN', 'ACTIVE', true, true],
  ['STUDENT', 'DISABLED', true, true],
  ['STUDENT', 'ACTIVE', false, true],
  ['STUDENT', 'ACTIVE', true, false],
] as const)
  test(
    'private background reads refused for denied fixture ' +
      role +
      status +
      emailVerified +
      session,
    async () => {
      const route = fixture();
      const allowed = backgroundStudent(
        { role, status, emailVerified },
        session,
      );
      assert.equal(allowed, false);
      assert.equal(
        await backgroundProgress(
          route,
          new URL(base + 'progress?conceptId=' + id),
          allowed,
        ),
        false,
      );
      assert.equal(route.responses.length, 0);
    },
  );
test('incomplete onboarding does not prevent eligible Concept background reads', () => {
  assert.equal(
    backgroundStudent(
      { role: 'STUDENT', status: 'ACTIVE', emailVerified: true },
      true,
    ),
    true,
  );
});
