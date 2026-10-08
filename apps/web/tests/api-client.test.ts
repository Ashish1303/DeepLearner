import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient, ApiError } from '../src/lib/api/client';
import { currentUserSchema } from '../src/lib/api/contracts';

const user = {
  id: 'a'.repeat(24),
  firstName: 'Test',
  lastName: 'Student',
  email: 'test@example.com',
  emailVerified: true,
  status: 'ACTIVE',
  role: 'STUDENT',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-06T00:00:00.000Z',
};
test('API client restricts endpoints, credentials, redirect behavior and response data', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createApiClient(
    'https://api.example.com/api/v1',
    async (input, init) => {
      assert(init);
      calls.push({ url: String(input), init });
      const data = String(input).endsWith('/users/me')
        ? {
            ...user,
            passwordHash: 'PRIVATE',
            authProviders: [{ providerUserId: 'PRIVATE' }],
          }
        : String(input).endsWith('/logout')
          ? null
          : {
              accessToken: 'synthetic-access',
              expiresInSeconds: 900,
              user: { private: true },
            };
      return Response.json({ success: true, data });
    },
  );
  assert.deepEqual(
    await client.login('test@example.com', 'synthetic-password'),
    { accessToken: 'synthetic-access', expiresInSeconds: 900 },
  );
  await client.refresh();
  assert.deepEqual(await client.me('synthetic-access'), user);
  await client.logout();
  assert.deepEqual(
    calls.map((c) => new URL(c.url).pathname),
    [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/users/me',
      '/api/v1/auth/logout',
    ],
  );
  assert.deepEqual(
    calls.map((c) => c.init.credentials),
    ['include', 'include', 'omit', 'include'],
  );
  assert(
    calls.every(
      (c) => c.init.cache === 'no-store' && c.init.redirect === 'error',
    ),
  );
  assert.equal(
    new Headers(calls[2]!.init.headers).get('Authorization'),
    'Bearer synthetic-access',
  );
  assert(!calls.some((c) => new Headers(c.init.headers).has('Cookie')));
});

test('API errors discard server messages, unknown codes and raw exceptions', async () => {
  for (const [status, code, expected] of [
    [401, 'AUTH_INVALID_CREDENTIALS', 'AUTH_INVALID_CREDENTIALS'],
    [503, 'PRIVATE_SENTINEL', 'REQUEST_FAILED'],
    [429, 'RATE_LIMIT_EXCEEDED', 'RATE_LIMIT_EXCEEDED'],
  ] as const) {
    let count = 0;
    const api = createApiClient('https://api.example.com/api/v1', async () => {
      count++;
      return Response.json(
        {
          error: {
            code,
            message: 'PRIVATE_SENTINEL',
            stack: 'PRIVATE_SENTINEL',
          },
        },
        { status },
      );
    });
    await assert.rejects(api.login('test@example.com', 'test'), (error) => {
      assert(error instanceof ApiError);
      assert.equal(error.code, expected);
      assert(!String(error).includes('PRIVATE_SENTINEL'));
      return true;
    });
    assert.equal(count, 1);
  }
  const network = createApiClient(
    'https://api.example.com/api/v1',
    async () => {
      throw new Error('PRIVATE_SENTINEL');
    },
  );
  await assert.rejects(network.refresh(), { code: 'NETWORK_ERROR' });
});

test('malformed success responses fail safely and timeout aborts without retry', async () => {
  const malformed = createApiClient(
    'https://api.example.com/api/v1',
    async () =>
      Response.json({
        success: true,
        data: { accessToken: 'x', expiresInSeconds: 1 },
      }),
  );
  await assert.rejects(malformed.refresh(), { code: 'INVALID_RESPONSE' });
  let count = 0;
  const timed = createApiClient(
    'https://api.example.com/api/v1',
    async (_input, init) => {
      count++;
      return new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener(
          'abort',
          () => reject(new Error('PRIVATE')),
          { once: true },
        );
      });
    },
    5,
  );
  await assert.rejects(timed.refresh(), { code: 'NETWORK_ERROR' });
  assert.equal(count, 1);
  for (const base of [
    'https://secret:password@api.example.com',
    'https://api.example.com?key=private',
    'ftp://api.example.com',
  ])
    assert.throws(() => createApiClient(base), { code: 'REQUEST_FAILED' });
});

test('current-user schema validates profile and strips nested unapproved fields', () => {
  const result = currentUserSchema.parse({
    ...user,
    profile: {
      learningGoals: [],
      interestedTechnologyIds: [],
      dailyStudyGoalMinutes: 30,
      private: 'PRIVATE',
    },
  });
  assert(!JSON.stringify(result).includes('PRIVATE'));
  assert(
    !currentUserSchema.safeParse({
      ...user,
      profile: { learningGoals: [null], interestedTechnologyIds: [] },
    }).success,
  );
});

test('invalid API configuration cannot expose the raw URL parser error', () => {
  assert.throws(
    () => createApiClient('PRIVATE_MALFORMED_URL'),
    (error) => {
      assert(error instanceof ApiError);
      assert.equal(error.code, 'REQUEST_FAILED');
      assert(!String(error).includes('PRIVATE_MALFORMED_URL'));
      return true;
    },
  );
});

test('profile PATCH sends only approved leaves with bearer auth, no cookies or manual Origin', async () => {
  const profile = {
    experienceLevel: 'BEGINNER' as const,
    learningGoals: ['LEARN_FROM_SCRATCH' as const],
    preferredDifficulty: 'BEGINNER' as const,
    dailyStudyGoalMinutes: 30,
  };
  let requests = 0;
  const api = createApiClient(
    'https://api.example.com/api/v1',
    async (url, init) => {
      requests++;
      assert.equal(String(url), 'https://api.example.com/api/v1/users/me');
      assert.equal(init?.method, 'PATCH');
      assert.equal(init.credentials, 'omit');
      assert.equal(init.cache, 'no-store');
      const headers = new Headers(init.headers);
      assert.equal(headers.get('Authorization'), 'Bearer synthetic-access');
      assert(!headers.has('Origin'));
      assert(!headers.has('Cookie'));
      assert.deepEqual(JSON.parse(String(init.body)), { profile });
      return Response.json({
        success: true,
        data: {
          ...user,
          profile: { ...profile, interestedTechnologyIds: [] },
          passwordHash: 'PRIVATE',
        },
      });
    },
  );
  const saved = await api.patchProfile('synthetic-access', profile);
  assert(!JSON.stringify(saved).includes('PRIVATE'));
  assert.equal(requests, 1);
});
