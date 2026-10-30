import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { createAdminAccessService } from '../src/modules/admin/admin-access.service.js';
import {
  adminLimitDefaults,
  type AdminLimits,
} from '../src/modules/admin/admin-rate-limit.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import type { AuthContext } from '../src/modules/auth/access-token.service.js';

Object.assign(process.env, {
  APP_ENV: 'LOCAL',
  EMAIL_PROVIDER: 'disabled',
  LOG_LEVEL: 'silent',
  GOOGLE_CLIENT_ID: '',
  MONGODB_URI: 'mongodb://127.0.0.1:27018',
  MONGODB_DB_NAME: 'unused-offline',
  ACCESS_TOKEN_SECRET: Buffer.from(
    Array.from({ length: 32 }, (_, i) => i + 1),
  ).toString('base64'),
  ACCESS_TOKEN_ISSUER: 'test',
  ACCESS_TOKEN_AUDIENCE: 'test',
  AUTH_COOKIE_SECURE: 'false',
  CORS_ORIGINS: 'http://127.0.0.1:3000,http://localhost:5173',
});
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { createAdminRouter } =
  await import('../src/modules/admin/admin.routes.js');
const { errorHandler } = await import('../src/middleware/error-handler.js');
const { requestId } = await import('../src/middleware/request-id.js');
const { notFound } = await import('../src/middleware/not-found.js');
const id = (n: number) => n.toString(16).padStart(24, '0');
const actor: AuthContext = {
  sub: id(1),
  sid: id(2),
  role: 'ADMIN',
  plan: 'FREE',
};

async function fixture(
  options: { probe?: boolean; limits?: Partial<AdminLimits> } = {},
) {
  const state = {
    reads: 0,
    handlers: 0,
    subjects: [] as string[],
    role: 'ADMIN',
    status: 'ACTIVE',
    verified: true,
    missing: false,
    failure: false,
    clientIp: undefined as string | undefined,
    delay: undefined as ((signal: AbortSignal) => Promise<void>) | undefined,
  };
  const service = createAdminAccessService({
    async read(sub, read) {
      state.reads++;
      state.subjects.push(sub);
      if (state.delay) await state.delay(read.signal);
      if (state.failure)
        throw new Error('private database address and credential');
      return state.missing
        ? null
        : {
            _id: new Types.ObjectId(sub),
            role: state.role,
            status: state.status,
            emailVerifiedAt: state.verified
              ? new Date('2026-01-01T00:00:00Z')
              : null,
          };
    },
  });
  const limits = { ...adminLimitDefaults, ...options.limits };
  let app;
  if (options.probe) {
    app = express();
    app.use(requestId);
    app.use((req, _res, next) => {
      // Trusted test-only transport adapter; production never reads an IP header.
      if (state.clientIp)
        Object.defineProperty(req, 'ip', { value: state.clientIp });
      next();
    });
    const router = createAdminRouter(service, limits);
    // Test-local endpoint only. The production router has no business handler.
    router.all('/probe', (_req, res) => {
      state.handlers++;
      res.json({ allowed: true });
    });
    app.use('/api/v1/admin', router);
    app.use(notFound);
    app.use(errorHandler);
  } else {
    const args: Parameters<typeof createApp> = [];
    args[28] = service;
    args[29] = limits;
    app = createApp(...args);
  }
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens = createAccessTokens(env);
  const token = await tokens.sign(actor);
  return {
    state,
    token,
    tokens,
    server,
    get: (
      route = '/api/v1/admin/probe',
      bearer: string | null = token,
      init: RequestInit = {},
    ) =>
      fetch(base + route, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(10000),
        headers: {
          ...(bearer === null ? {} : { Authorization: 'Bearer ' + bearer }),
          ...init.headers,
        },
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
function assertRawErrorPrivacy(raw: unknown) {
  const refuse = () => assert.fail('Error response privacy check refused');
  const record = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  const keys = (value: Record<string, unknown>, allowed: readonly string[]) => {
    if (Object.keys(value).some((key) => !allowed.includes(key))) refuse();
  };
  if (!record(raw)) return refuse();
  keys(raw, ['success', 'error', 'meta']);
  if (!record(raw.error) || !record(raw.meta)) return refuse();
  keys(raw.error, ['code', 'message', 'details']);
  keys(raw.meta, ['requestId']);
  if (
    typeof raw.error.message !== 'string' ||
    typeof raw.error.code !== 'string' ||
    typeof raw.meta.requestId !== 'string'
  )
    return refuse();
  const strings = [raw.error.message, raw.error.code, raw.meta.requestId];
  if (raw.error.details !== undefined) {
    if (!Array.isArray(raw.error.details)) return refuse();
    for (const detail of raw.error.details) {
      if (!record(detail)) return refuse();
      keys(detail, ['field', 'message']);
      if (
        typeof detail.field !== 'string' ||
        typeof detail.message !== 'string'
      )
        return refuse();
      strings.push(detail.field, detail.message);
    }
  }
  // Inspect decoded strings as well as the complete raw JSON. This catches
  // ordinary V8 stack frames even without an Error: prefix or internal path.
  const stackFrame =
    /(?:^|\r?\n)[ \t]*at[ \t]+(?:(?:async[ \t]+)?(?:[^\r\n]*\()?[^()\r\n]*:\d+(?::\d+)?\)?|[^\r\n]*\((?:native|<anonymous>)\))[ \t]*(?=\r?\n|$)/;
  if (strings.some((value) => stackFrame.test(value))) return refuse();
  // No projection may strip a private field before this check. Refusals never
  // echo the body, raw values or the schema's diagnostic payload.
  const text = JSON.stringify(raw);
  if (
    /private|passwordHash|emailVerifiedAt|stack|127\.0\.0\.1|accessToken|Mongo(?:Server|Network|BulkWrite|Parse)Error|(?:Error|Exception)\s*:|Traceback|node:internal/i.test(
      text,
    )
  )
    return refuse();
}
async function error(response: Response, status: number, code: string) {
  assert(response.status === status, 'Unexpected error HTTP status');
  assert(
    response.headers.get('cache-control') === 'no-store',
    'Error response must be no-store',
  );
  assert(
    response.headers.get('set-cookie') === null,
    'Error response must not set a cookie',
  );
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    assert.fail('Error response JSON decoding refused');
  }
  assertRawErrorPrivacy(raw);
  const parsed = z
    .object({
      success: z.literal(false),
      error: z.object({ code: z.string() }),
      meta: z.object({ requestId: z.string() }),
    })
    .safeParse(raw);
  assert(parsed.success, 'Error response schema validation refused');
  const body = parsed.data;
  assert(body.success === false, 'Error response must indicate failure');
  assert(body.error.code === code, 'Unexpected error response code');
  assert(
    body.meta.requestId === response.headers.get('x-request-id'),
    'Error response request ID mismatch',
  );
}

test('real JWT and current Admin eligibility reach only a test-local handler', async (t) => {
  const f = await fixture({ probe: true });
  t.after(f.close);
  assert.deepEqual(await (await f.get()).json(), { allowed: true });
  assert.equal(f.state.reads, 1);
  assert.equal(f.state.handlers, 1);
});
test('no JWT refuses before account reads', async (t) => {
  const f = await fixture();
  t.after(f.close);
  await error(await f.get(undefined, null), 401, 'AUTH_ACCESS_TOKEN_MISSING');
  assert.equal(f.state.reads, 0);
});
for (const bearer of ['bad', 'a.b.c'])
  test(`malformed JWT ${bearer} refuses before account reads`, async (t) => {
    const f = await fixture();
    t.after(f.close);
    await error(
      await f.get(undefined, bearer),
      401,
      'AUTH_ACCESS_TOKEN_INVALID',
    );
    assert.equal(f.state.reads, 0);
  });
test('expired JWT uses existing expired-token semantics', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const expired = await createAccessTokens(
    env,
    () => new Date(Date.now() - 901000),
  ).sign(actor);
  await error(
    await f.get(undefined, expired),
    401,
    'AUTH_ACCESS_TOKEN_EXPIRED',
  );
  assert.equal(f.state.reads, 0);
});
test('wrong signature refuses before account reads', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const invalid = await createAccessTokens({
    ...env,
    ACCESS_TOKEN_SECRET: Buffer.alloc(32, 9).toString('base64'),
  }).sign(actor);
  await error(
    await f.get(undefined, invalid),
    401,
    'AUTH_ACCESS_TOKEN_INVALID',
  );
  assert.equal(f.state.reads, 0);
});
test('Student JWT remains denied even when stored account is promoted', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const token = await f.tokens.sign({ ...actor, role: 'STUDENT' });
  await error(await f.get(undefined, token), 403, 'AUTH_FORBIDDEN');
  assert.equal(f.state.reads, 0);
});
for (const [name, change] of [
  ['demoted', { role: 'STUDENT' }],
  ['disabled', { status: 'DISABLED' }],
  ['suspended', { status: 'SUSPENDED' }],
  ['pending', { status: 'PENDING_VERIFICATION' }],
  ['unverified', { verified: false }],
  ['deleted', { missing: true }],
] as const)
  test(`${name} account gets generic denial with no private detail`, async (t) => {
    const f = await fixture();
    t.after(f.close);
    Object.assign(f.state, change);
    await error(await f.get(), 403, 'AUTH_FORBIDDEN');
    assert.equal(f.state.reads, 1);
  });
test('current account is checked every time; prior successful authorization is never cached', async (t) => {
  const f = await fixture({ probe: true });
  t.after(f.close);
  assert.equal((await f.get()).status, 200);
  f.state.role = 'STUDENT';
  await error(await f.get(), 403, 'AUTH_FORBIDDEN');
  assert.equal(f.state.reads, 2);
  assert.equal(f.state.handlers, 1);
});
for (const route of [
  '/api/v1/admin',
  '/api/v1/admin/',
  '/api/v1/admin/a/b',
  '/API/V1/ADMIN/Future',
])
  test(`eligible Admin receives existing 404 at ${route}`, async (t) => {
    const f = await fixture();
    t.after(f.close);
    await error(await f.get(route), 404, 'ROUTE_NOT_FOUND');
    assert.equal(f.state.reads, 1);
  });
for (const method of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD'])
  test(`${method} descendant cannot bypass namespace authentication`, async (t) => {
    const f = await fixture();
    t.after(f.close);
    const response = await f.get('/api/v1/admin/anything', null, { method });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(f.state.reads, 0);
    await response.arrayBuffer();
  });
test('request-supplied identity, role and forwarded IP do not become authority', async (t) => {
  const f = await fixture();
  t.after(f.close);
  await error(
    await f.get('/api/v1/admin?userId=' + id(9) + '&role=ADMIN', f.token, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '192.0.2.1',
      },
      body: JSON.stringify({ userId: id(9), role: 'ADMIN' }),
    }),
    404,
    'ROUTE_NOT_FOUND',
  );
  assert.deepEqual(f.state.subjects, [actor.sub]);
});
test('dependency failure is sanitized 503 without account details or token', async (t) => {
  const f = await fixture();
  t.after(f.close);
  f.state.failure = true;
  await error(await f.get(), 503, 'DEPENDENCY_UNAVAILABLE');
});
test(
  'real wall-clock read expiry returns 503 and never reaches a downstream handler',
  { timeout: 15000 },
  async (t) => {
    const f = await fixture({ probe: true });
    t.after(f.close);
    let aborted = false;
    f.state.delay = (signal) =>
      new Promise((resolve) => {
        signal.addEventListener(
          'abort',
          () => {
            aborted = true;
            resolve();
          },
          { once: true },
        );
      });
    const started = performance.now();
    await error(await f.get(), 503, 'DEPENDENCY_UNAVAILABLE');
    assert(performance.now() - started >= 4900);
    assert.equal(aborted, true);
    assert.equal(f.state.handlers, 0);
  },
);
test(
  'client cancellation prevents dispatch even when the read subsequently completes',
  { timeout: 15000 },
  async (t) => {
    const f = await fixture({ probe: true });
    const controller = new AbortController();
    const phaseBudgetMs = 1000;
    async function withinPhase<T>(phase: string, work: Promise<T>): Promise<T> {
      const start = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('HTTP cancellation phase exceeded: ' + phase)),
          phaseBudgetMs,
        );
      });
      try {
        const result = await Promise.race([work, deadline]);
        const elapsed = performance.now() - start;
        assert(
          Number.isFinite(elapsed) && elapsed >= 0 && elapsed < phaseBudgetMs,
          'HTTP cancellation phase completed too late: ' + phase,
        );
        return result;
      } finally {
        clearTimeout(timer);
      }
    }
    type Outcome =
      | { kind: 'response'; response: Response }
      | { kind: 'error'; error: unknown };
    const requestState: { settled?: Promise<Outcome> } = {};
    t.after(async () => {
      controller.abort();
      try {
        await withinPhase('SERVER_CLEANUP', f.close());
      } finally {
        if (requestState.settled) {
          const outcome = await withinPhase(
            'REQUEST_CLEANUP',
            requestState.settled,
          );
          if (outcome.kind === 'response' && outcome.response.body)
            await withinPhase('BODY_CLEANUP', outcome.response.body.cancel());
        }
      }
    });
    let entered: () => void = () => {};
    let cancelled: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const observed = new Promise<void>((resolve) => {
      cancelled = resolve;
    });
    f.state.delay = (signal) =>
      new Promise((resolve) => {
        entered();
        signal.addEventListener(
          'abort',
          () => {
            resolve();
            cancelled();
          },
          { once: true },
        );
      });
    const requestStarted = performance.now();
    const response = f.get(undefined, f.token, { signal: controller.signal });
    // Observe every rejection immediately, without accepting it as cancellation.
    requestState.settled = response.then(
      (value): Outcome => ({ kind: 'response', response: value }),
      (error: unknown): Outcome => ({ kind: 'error', error }),
    );
    try {
      const admission = await withinPhase(
        'READ_ADMISSION',
        Promise.race([
          started.then(() => ({ kind: 'entered' as const })),
          requestState.settled,
        ]),
      );
      if (admission.kind === 'error') throw admission.error;
      if (admission.kind === 'response')
        assert.fail(
          'Request completed before cancellation read admission; HTTP ' +
            admission.response.status,
        );
      controller.abort();
      await withinPhase(
        'CLIENT_ABORT',
        assert.rejects(response, { name: 'AbortError' }),
      );
      await withinPhase('SERVER_ABORT', observed);
      // Allow the completed mock read and middleware continuations to drain.
      await withinPhase(
        'POST_CANCELLATION_DRAIN',
        new Promise<void>((resolve) => setImmediate(resolve)),
      );
      const elapsed = performance.now() - requestStarted;
      assert(
        Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 4000,
        'Client cancellation must be observed before the five-second service deadline',
      );
      assert.equal(f.state.reads, 1);
      assert.equal(f.state.handlers, 0);
    } finally {
      controller.abort();
    }
  },
);
test('early CORS and JSON parser errors still carry no-store', async (t) => {
  const f = await fixture();
  t.after(f.close);
  await error(
    await f.get(undefined, f.token, {
      headers: { Origin: 'https://unapproved.invalid' },
    }),
    403,
    'ORIGIN_NOT_ALLOWED',
  );
  await error(
    await f.get(undefined, f.token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
    400,
    'VALIDATION_ERROR',
  );
  assert.equal(f.state.reads, 0);
});
test('allowed CORS preflight neither authorizes nor reads an account', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const response = await f.get(undefined, null, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:5173',
  );
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.equal(f.state.reads, 0);
});
test('IP limit runs before JWT/account work and ignores forwarded-IP spoofing', async (t) => {
  const f = await fixture({ limits: { ip: 1 } });
  t.after(f.close);
  await error(await f.get(undefined, null), 401, 'AUTH_ACCESS_TOKEN_MISSING');
  await error(
    await f.get(undefined, null, {
      headers: { 'X-Forwarded-For': '192.0.2.222' },
    }),
    429,
    'RATE_LIMIT_EXCEEDED',
  );
  assert.equal(f.state.reads, 0);
});
test('IPv6 addresses in one /56 share an IP quota while another /56 is independent', async (t) => {
  const f = await fixture({ probe: true, limits: { ip: 1 } });
  t.after(f.close);
  f.state.clientIp = '2001:db8:1234:5600::1';
  assert.equal((await f.get()).status, 200);
  f.state.clientIp = '2001:db8:1234:56ff::2';
  await error(await f.get(), 429, 'RATE_LIMIT_EXCEEDED');
  f.state.clientIp = '2001:db8:1234:5700::1';
  assert.equal((await f.get()).status, 200);
  assert.equal(f.state.reads, 2);
});
test('account limit spans JWTs/sessions and is enforced before additional database reads', async (t) => {
  const f = await fixture({ limits: { account: 1 } });
  t.after(f.close);
  await error(await f.get(), 404, 'ROUTE_NOT_FOUND');
  const another = await f.tokens.sign({ ...actor, sid: id(7) });
  await error(await f.get(undefined, another), 429, 'RATE_LIMIT_EXCEEDED');
  const otherUser = await f.tokens.sign({ ...actor, sub: id(8) });
  await error(await f.get(undefined, otherUser), 404, 'ROUTE_NOT_FOUND');
  assert.equal(f.state.reads, 2);
});
test('exhausted account-key capacity refuses without discarding prior counters', async (t) => {
  const f = await fixture({ limits: { capacity: 1, account: 1 } });
  t.after(f.close);
  await error(await f.get(), 404, 'ROUTE_NOT_FOUND');
  await error(
    await f.get(undefined, await f.tokens.sign({ ...actor, sub: id(9) })),
    503,
    'DEPENDENCY_UNAVAILABLE',
  );
  await error(await f.get(), 429, 'RATE_LIMIT_EXCEEDED');
  assert.equal(f.state.reads, 1);
});
test('parallel eligible requests remain read-only and do not share identity', async (t) => {
  const f = await fixture({ probe: true });
  t.after(f.close);
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => {
      const token = await f.tokens.sign({ ...actor, sub: id(i + 20) });
      return (await f.get(undefined, token)).status;
    }),
  );
  assert.deepEqual(outcomes, Array(8).fill(200));
  assert.equal(new Set(f.state.subjects).size, 8);
  assert.equal(f.state.handlers, 8);
});
test('adjacent non-Admin namespace preserves existing public health and 404 behavior', async (t) => {
  const f = await fixture();
  t.after(f.close);
  assert.equal((await f.get('/api/v1/administrator', null)).status, 404);
  assert.equal((await f.get('/api/v1/health', null)).status, 200);
  assert.equal(f.state.reads, 0);
});

// In-process synthetic response fixtures only. Select this prefix for offline
// verification; the existing HTTP listener tests above remain unexecuted.
const privacyFixture = (
  code = 'AUTH_FORBIDDEN',
  message = 'Admin access required',
) => ({
  success: false,
  error: { code, message },
  meta: { requestId: 'f042-offline-privacy' },
});
const privacyResponse = (body: unknown, status = 403) =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-Id': 'f042-offline-privacy',
    },
  });
for (const [status, code, message] of [
  [403, 'AUTH_FORBIDDEN', 'Admin access required'],
  [
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Admin authorization is temporarily unavailable',
  ],
  [401, 'AUTH_ACCESS_TOKEN_MISSING', 'Access token required'],
  [401, 'AUTH_ACCESS_TOKEN_INVALID', 'Access token is invalid or expired'],
  [429, 'RATE_LIMIT_EXCEEDED', 'Too many requests; try again later'],
] as const)
  test('F042 offline privacy: valid sanitized envelope ' + code, async () => {
    await error(
      privacyResponse(privacyFixture(code, message), status),
      status,
      code,
    );
  });
test('F042 offline privacy: valid public validation details remain accepted', async () => {
  const body = {
    ...privacyFixture('VALIDATION_ERROR', 'Invalid request'),
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [{ field: 'email', message: 'Invalid email address' }],
    },
  };
  await error(privacyResponse(body, 400), 400, 'VALIDATION_ERROR');
});
for (const [name, body] of [
  [
    'unknown root field',
    { ...privacyFixture(), unexpected: 'benign-extra-field' },
  ],
  [
    'root sensitive field',
    { ...privacyFixture(), passwordHash: 'SYNTHETIC_PRIVATE_MARKER' },
  ],
  [
    'nested unknown field',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        extra: { note: 'benign-extra-field' },
      },
    },
  ],
  [
    'nested sensitive field',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        passwordHash: 'SYNTHETIC_PRIVATE_MARKER',
      },
    },
  ],
  [
    'internal error message',
    privacyFixture(
      'AUTH_FORBIDDEN',
      'MongoServerError: SYNTHETIC_INTERNAL_MARKER',
    ),
  ],
  [
    'nested error message object',
    {
      ...privacyFixture(),
      error: {
        code: 'AUTH_FORBIDDEN',
        message: { nested: 'SYNTHETIC_PRIVATE_MARKER' },
      },
    },
  ],
  [
    'stack trace field',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        stack: 'Error: SYNTHETIC_INTERNAL_MARKER at node:internal/test',
      },
    },
  ],
  [
    'stack trace in message',
    privacyFixture(
      'AUTH_FORBIDDEN',
      'Error: SYNTHETIC_INTERNAL_MARKER at node:internal/test',
    ),
  ],
  [
    'private detail message',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        details: [{ field: 'account', message: 'SYNTHETIC_PRIVATE_MARKER' }],
      },
    },
  ],
  [
    'nested detail field',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        details: [
          {
            field: 'account',
            message: 'Invalid value',
            cause: { detail: 'SYNTHETIC_PRIVATE_MARKER' },
          },
        ],
      },
    },
  ],
  [
    'nested metadata field',
    {
      ...privacyFixture(),
      meta: {
        ...privacyFixture().meta,
        internal: { note: 'SYNTHETIC_INTERNAL_MARKER' },
      },
    },
  ],
  [
    'nested detail message object',
    {
      ...privacyFixture(),
      error: {
        ...privacyFixture().error,
        details: [
          { field: 'account', message: { note: 'SYNTHETIC_PRIVATE_MARKER' } },
        ],
      },
    },
  ],
] as const)
  test('F042 offline privacy: refuses ' + name, async () => {
    await assert.rejects(error(privacyResponse(body), 403, 'AUTH_FORBIDDEN'), {
      message: 'Error response privacy check refused',
      code: 'ERR_ASSERTION',
    });
  });
test('F042 offline privacy: schema stripping cannot conceal internal data', async () => {
  const raw = {
    ...privacyFixture(),
    error: {
      ...privacyFixture().error,
      message: 'SYNTHETIC_PRIVATE_MARKER',
      stack: 'SYNTHETIC_INTERNAL_MARKER',
    },
  };
  const projected = z
    .object({
      success: z.literal(false),
      error: z.object({ code: z.string() }),
      meta: z.object({ requestId: z.string() }),
    })
    .parse(raw);
  assert(!JSON.stringify(projected).includes('SYNTHETIC_PRIVATE_MARKER'));
  await assert.rejects(error(privacyResponse(raw), 403, 'AUTH_FORBIDDEN'), {
    message: 'Error response privacy check refused',
  });
});
test('F042 offline privacy: refusal precedes schema projection and exposes no payload', async () => {
  const marker = 'SYNTHETIC_PRIVATE_MARKER';
  let caught: unknown;
  try {
    await error(
      privacyResponse({
        ...privacyFixture(),
        success: 'invalid',
        stack: marker,
      }),
      403,
      'AUTH_FORBIDDEN',
    );
  } catch (failure) {
    caught = failure;
  }
  assert(caught instanceof Error);
  assert.equal(caught.message, 'Error response privacy check refused');
  assert(!String(caught).includes(marker));
  assert(!JSON.stringify(caught).includes(marker));
});

for (const [name, message] of [
  [
    'message-less Windows V8 stack',
    'Error\n    at read (E:\\synthetic\\repository.ts:12:3)',
  ],
  [
    'message-less POSIX V8 stack',
    'Error\n    at /synthetic/repository.ts:12:3',
  ],
  [
    'async application stack frame',
    'Failure\n    at async read (file:///synthetic/repository.ts:12:3)',
  ],
] as const)
  test('F042 offline privacy: refuses ' + name, async () => {
    await assert.rejects(
      error(
        privacyResponse(privacyFixture('AUTH_FORBIDDEN', message)),
        403,
        'AUTH_FORBIDDEN',
      ),
      { message: 'Error response privacy check refused' },
    );
  });
test('F042 offline privacy: ordinary public validation wording is not a stack trace', async () => {
  const raw = {
    ...privacyFixture('VALIDATION_ERROR', 'Invalid request'),
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [
        { field: 'password', message: 'At least 10 characters are required' },
      ],
    },
  };
  await error(privacyResponse(raw, 400), 400, 'VALIDATION_ERROR');
});
for (const name of [
  'unexpected code',
  'unexpected request ID',
  'unexpected request header',
  'unexpected cookie header',
  'unexpected cache header',
  'invalid schema value',
] as const)
  test(
    'F042 offline privacy: diagnostics hide raw values for ' + name,
    async () => {
      const marker = 'SYNTHETIC_CONFIDENTIAL_VALUE_7Q2';
      const raw: {
        success: unknown;
        error: { code: string; message: string };
        meta: { requestId: string };
      } = privacyFixture();
      const headers: Record<string, string> = {
        'Cache-Control': 'no-store',
        'X-Request-Id': 'f042-offline-privacy',
      };
      if (name === 'unexpected code') raw.error.code = marker;
      if (name === 'unexpected request ID') raw.meta.requestId = marker;
      if (name === 'unexpected request header')
        headers['X-Request-Id'] = marker;
      if (name === 'unexpected cookie header')
        headers['Set-Cookie'] = 'synthetic=' + marker;
      if (name === 'unexpected cache header') headers['Cache-Control'] = marker;
      if (name === 'invalid schema value') raw.success = marker;
      let caught: unknown;
      try {
        await error(
          Response.json(raw, { status: 403, headers }),
          403,
          'AUTH_FORBIDDEN',
        );
      } catch (failure) {
        caught = failure;
      }
      assert(caught instanceof Error);
      assert(
        !String(caught).includes(marker),
        'Failure text must not expose the fixture',
      );
      assert(
        !JSON.stringify(caught).includes(marker),
        'Failure data must not expose the fixture',
      );
    },
  );

for (const [name, message] of [
  ['native V8 frame', 'Error\n    at read (native)'],
  ['anonymous V8 frame', 'Error\n    at new Promise (<anonymous>)'],
] as const)
  test('F042 offline privacy: refuses ' + name, async () => {
    await assert.rejects(
      error(
        privacyResponse(privacyFixture('AUTH_FORBIDDEN', message)),
        403,
        'AUTH_FORBIDDEN',
      ),
      { message: 'Error response privacy check refused' },
    );
  });
test('F042 offline privacy: malformed JSON decoding never exposes a response excerpt', async () => {
  const marker = 'SYNTHETIC_CONFIDENTIAL_VALUE_7Q2';
  let caught: unknown;
  try {
    await error(
      new Response(marker, {
        status: 403,
        headers: { 'Cache-Control': 'no-store' },
      }),
      403,
      'AUTH_FORBIDDEN',
    );
  } catch (failure) {
    caught = failure;
  }
  assert(caught instanceof Error);
  assert.equal(caught.message, 'Error response JSON decoding refused');
  assert(!String(caught).includes(marker));
  assert(!JSON.stringify(caught).includes(marker));
});
