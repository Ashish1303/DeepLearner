import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAdminClient, AdminApiError } from '../src/lib/auth/admin-client';
import { currentUserSchema, projectAdmin } from '../src/lib/auth/contracts';

const root = 'http://localhost:4000/api/v1';
const token = 'synthetic-access';
const password = 'synthetic-password';
const user = {
  id: 'a'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  plan: 'FREE' as const,
  emailVerified: true,
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-29T00:00:00.000Z',
};
const loginUser = {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  status: user.status,
  plan: user.plan,
};
const refresh = { accessToken: token, expiresInSeconds: 900 };
const login = { ...refresh, user: loginUser };
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'fixture-request' },
});
const failure = (code: string) => ({
  success: false,
  error: { code, message: 'PRIVATE_SERVER_DETAIL' },
  meta: { requestId: 'fixture-request' },
});
const responder =
  (raw: unknown, status = 200): typeof fetch =>
  async () =>
    Response.json(raw, { status });
test('only existing endpoints, exact credential modes, Bearer/no-store/redirect refusal', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createAdminClient(root, async (url, init) => {
    assert(init);
    calls.push({ url: String(url), init });
    const path = new URL(String(url)).pathname;
    return Response.json(
      envelope(
        path.endsWith('/login')
          ? login
          : path.endsWith('/refresh')
            ? refresh
            : path.endsWith('/logout')
              ? null
              : user,
      ),
    );
  });
  assert.deepEqual(await api.login(' ADMIN@example.test ', password), login);
  assert.deepEqual(await api.refresh(), refresh);
  assert.deepEqual(await api.me(token), user);
  assert.equal(await api.logout(), null);
  assert.deepEqual(
    calls.map((c) => c.url),
    [
      root + '/auth/login',
      root + '/auth/refresh',
      root + '/users/me',
      root + '/auth/logout',
    ],
  );
  assert.deepEqual(
    calls.map((c) => c.init.credentials),
    ['include', 'include', 'omit', 'include'],
  );
  assert.deepEqual(
    calls.map((c) => c.init.method),
    ['POST', 'POST', 'GET', 'POST'],
  );
  assert(
    calls.every(
      (c) => c.init.cache === 'no-store' && c.init.redirect === 'error',
    ),
  );
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    email: user.email,
    password,
  });
  assert.equal(
    new Headers(calls[2]!.init.headers).get('Authorization'),
    'Bearer ' + token,
  );
  assert(
    calls.every(
      (c) =>
        !new Headers(c.init.headers).has('Cookie') &&
        !new Headers(c.init.headers).has('Origin'),
    ),
  );
});
for (const base of [
  'ftp://api.deeplearner.com/api/v1',
  'http://api.deeplearner.com/api/v1',
  'https://evil.example/api/v1',
  'https://api.deeplearner.com.evil.example/api/v1',
  'https://api.deeplearner.com:444/api/v1',
  'https://name:secret@api.deeplearner.com/api/v1',
  'http://localhost:4000/api/v1?token=private',
  'http://localhost:4000/api/v1#private',
  'http://localhost:4001/api/v1',
  'http://localhost:4000/api/v2',
  'http://localhost:4000/api/v1/other',
  'PRIVATE_INVALID',
])
  test('unapproved API base refused: ' + base.split('?')[0], () => {
    assert.throws(() => createAdminClient(base), { code: 'REQUEST_FAILED' });
  });
for (const base of [
  'https://api.deeplearner.com/api/v1',
  'http://localhost:4000/api/v1/',
  'http://127.0.0.1:4000/api/v1',
  'http://[::1]:4000/api/v1',
])
  test('approved API base accepted: ' + base, () => {
    assert.doesNotThrow(() => createAdminClient(base));
  });
for (const timeout of [0, -1, 15001, NaN, Infinity, 1.5])
  test('invalid request timeout refused: ' + timeout, () => {
    assert.throws(() => createAdminClient(root, fetch, timeout), {
      code: 'REQUEST_FAILED',
    });
  });
for (const [label, data] of [
  ['missing login identity', refresh],
  ['private token field', { ...login, refreshToken: 'PRIVATE' }],
  [
    'private login identity',
    { ...login, user: { ...loginUser, passwordHash: 'PRIVATE' } },
  ],
  ['wrong lifetime', { ...login, expiresInSeconds: 901 }],
  ['empty access token', { ...login, accessToken: '' }],
  ['header injection token', { ...login, accessToken: 'private\r\ninjection' }],
  ['unknown role', { ...login, user: { ...loginUser, role: 'ROOT' } }],
  ['inactive login', { ...login, user: { ...loginUser, status: 'DISABLED' } }],
  ['invalid identity', { ...login, user: { ...loginUser, id: 'bad' } }],
] as const)
  test('strict login DTO rejects ' + label, async () => {
    await assert.rejects(
      createAdminClient(root, responder(envelope(data))).login(
        user.email,
        password,
      ),
      { code: 'INVALID_RESPONSE' },
    );
  });
for (const [label, patch] of [
  ['private root', { passwordHash: 'PRIVATE' }],
  ['unknown flag', { approved: true }],
  ['missing eligibility', { emailVerified: undefined }],
  ['unknown status', { status: 'UNKNOWN' }],
  ['malformed identity', { id: null }],
  [
    'private nested profile',
    {
      profile: {
        learningGoals: [],
        interestedTechnologyIds: [],
        password: 'PRIVATE',
      },
    },
  ],
  ['duplicate methods', { authMethods: ['PASSWORD', 'PASSWORD'] }],
  ['invalid time', { createdAt: 'yesterday' }],
] as const)
  test('strict current-user DTO rejects ' + label, async () => {
    await assert.rejects(
      createAdminClient(root, responder(envelope({ ...user, ...patch }))).me(
        token,
      ),
      { code: 'INVALID_RESPONSE' },
    );
  });
for (const raw of [
  { success: true, data: refresh },
  { ...envelope(refresh), meta: { requestId: 'id', secret: 'PRIVATE' } },
  { ...envelope(refresh), private: 'PRIVATE' },
  { ...envelope(refresh), success: false },
  { ...envelope(refresh), data: { ...refresh, user: loginUser } },
  { ...envelope(refresh), message: { private: true } },
])
  test(
    'canonical refresh envelope required ' + JSON.stringify(raw).slice(0, 65),
    async () => {
      await assert.rejects(createAdminClient(root, responder(raw)).refresh(), {
        code: 'INVALID_RESPONSE',
      });
    },
  );
for (const [status, code] of [
  [401, 'AUTH_ACCESS_TOKEN_EXPIRED'],
  [403, 'AUTH_ACCOUNT_DISABLED'],
  [403, 'AUTH_ACCOUNT_SUSPENDED'],
  [403, 'AUTH_EMAIL_NOT_VERIFIED'],
  [403, 'AUTH_FORBIDDEN'],
  [404, 'USER_NOT_FOUND'],
  [404, 'ROUTE_NOT_FOUND'],
  [429, 'RATE_LIMIT_EXCEEDED'],
  [503, 'DEPENDENCY_UNAVAILABLE'],
] as const)
  test('safe canonical error ' + code, async () => {
    let calls = 0;
    const api = createAdminClient(root, async () => {
      calls++;
      return Response.json(failure(code), { status });
    });
    await assert.rejects(api.me(token), (error) => {
      assert(error instanceof AdminApiError);
      assert.equal(error.code, code);
      assert.equal(error.status, status);
      assert(!JSON.stringify(error).includes('PRIVATE_SERVER_DETAIL'));
      assert(!String(error).includes('PRIVATE_SERVER_DETAIL'));
      return true;
    });
    assert.equal(calls, 1);
  });
test('unknown errors are sanitized and contradictory/private envelopes are refused', async () => {
  await assert.rejects(
    createAdminClient(root, responder(failure('PRIVATE_CODE'), 500)).refresh(),
    { code: 'REQUEST_FAILED', status: 500 },
  );
  await assert.rejects(
    createAdminClient(
      root,
      responder(failure('AUTH_FORBIDDEN'), 401),
    ).refresh(),
    { code: 'INVALID_RESPONSE' },
  );
  const privateError = failure('AUTH_FORBIDDEN');
  await assert.rejects(
    createAdminClient(
      root,
      responder(
        { ...privateError, error: { ...privateError.error, stack: 'PRIVATE' } },
        403,
      ),
    ).refresh(),
    { code: 'INVALID_RESPONSE' },
  );
  await assert.rejects(
    createAdminClient(
      root,
      responder({ error: { code: 'AUTH_FORBIDDEN' } }, 403),
    ).refresh(),
    { code: 'INVALID_RESPONSE' },
  );
});
test('logout accepts only canonical null success; 404 is never authorization', async () => {
  await assert.rejects(
    createAdminClient(root, responder(envelope({ loggedOut: true }))).logout(),
    { code: 'INVALID_RESPONSE' },
  );
  await assert.rejects(
    createAdminClient(root, responder(envelope(user), 404)).me(token),
    { code: 'INVALID_RESPONSE' },
  );
  await assert.rejects(
    createAdminClient(root, responder(envelope(user), 201)).me(token),
    { code: 'INVALID_RESPONSE' },
  );
});
test('response size, media type, redirect and malformed JSON boundaries', async () => {
  for (const response of [
    new Response('private', { headers: { 'content-type': 'text/plain' } }),
    new Response('{', { headers: { 'content-type': 'application/json' } }),
    new Response('x'.repeat(65537), {
      headers: { 'content-type': 'application/json' },
    }),
    new Response('{}', {
      headers: {
        'content-type': 'application/json',
        'content-length': '65537',
      },
    }),
  ]) {
    await assert.rejects(
      createAdminClient(root, async () => response).refresh(),
      { code: 'INVALID_RESPONSE' },
    );
  }
  const redirect = Response.json(envelope(refresh));
  Object.defineProperty(redirect, 'redirected', { value: true });
  await assert.rejects(
    createAdminClient(root, async () => redirect).refresh(),
    { code: 'INVALID_RESPONSE' },
  );
  const wrongUrl = Response.json(envelope(refresh));
  Object.defineProperty(wrongUrl, 'url', {
    value: 'https://evil.example/collect',
  });
  await assert.rejects(
    createAdminClient(root, async () => wrongUrl).refresh(),
    { code: 'INVALID_RESPONSE' },
  );
});
test('timeouts bound ignored abort and stalled body reads without retry', async () => {
  for (const body of [false, true]) {
    let calls = 0;
    const api = createAdminClient(
      root,
      async () => {
        calls++;
        if (!body) return new Promise<Response>(() => {});
        return new Response(new ReadableStream({ start() {} }), {
          headers: { 'content-type': 'application/json' },
        });
      },
      5,
    );
    await assert.rejects(api.refresh(), { code: 'TIMEOUT' });
    assert.equal(calls, 1);
  }
});
test('external cancellation is sanitized, including already cancelled requests', async () => {
  const abort = new AbortController();
  let calls = 0;
  const api = createAdminClient(root, async () => {
    calls++;
    return new Promise<Response>(() => {});
  });
  const pending = api.me(token, abort.signal);
  abort.abort('PRIVATE_REASON');
  await assert.rejects(pending, (error) => {
    assert(error instanceof AdminApiError && error.code === 'CANCELLED');
    assert(!String(error).includes('PRIVATE_REASON'));
    return true;
  });
  await assert.rejects(api.refresh(abort.signal), { code: 'CANCELLED' });
  assert.equal(calls, 1);
});
test('network exceptions and malformed credentials never disclose private values', async () => {
  let calls = 0;
  const api = createAdminClient(root, async () => {
    calls++;
    throw new Error(password);
  });
  await assert.rejects(api.login('bad', password), {
    code: 'VALIDATION_ERROR',
  });
  await assert.rejects(api.login(user.email, 'short'), {
    code: 'VALIDATION_ERROR',
  });
  await assert.rejects(api.me('bad\r\ntoken'), { code: 'VALIDATION_ERROR' });
  assert.equal(calls, 0);
  await assert.rejects(api.refresh(), (error) => {
    assert(error instanceof AdminApiError && error.code === 'NETWORK_ERROR');
    assert(!String(error).includes(password));
    return true;
  });
  assert.equal(calls, 1);
});
test('projection is immutable, minimal and requires all eligibility fields', () => {
  const projection = projectAdmin(user);
  assert(projection && Object.isFrozen(projection));
  assert.deepEqual(
    Object.keys(projection).sort(),
    [
      'id',
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'emailVerified',
    ].sort(),
  );
  assert(currentUserSchema.safeParse(user).success);
  for (const patch of [
    { role: 'STUDENT' },
    { status: 'DISABLED' },
    { status: 'SUSPENDED' },
    { status: 'PENDING_VERIFICATION' },
    { emailVerified: false },
    { emailVerified: undefined },
    { id: undefined },
  ])
    assert.equal(projectAdmin({ ...user, ...patch }), null);
});
