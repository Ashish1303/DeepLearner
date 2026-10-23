import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { AppError } from '../src/common/errors/app-error.js';
import {
  createDashboardLimitStore,
  createDashboardRateLimits,
  dashboardLimitDefaults,
} from '../src/modules/progress/dashboard-rate-limit.js';
import { createDashboardService } from '../src/modules/progress/dashboard.service.js';
import type { DashboardData } from '../src/modules/progress/dashboard.dto.js';
import type { DashboardRepository } from '../src/modules/progress/dashboard.repository.js';

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
  CORS_ORIGINS: 'http://127.0.0.1:3000',
});
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { createAccessTokens } =
  await import('../src/modules/auth/access-token.service.js');
const id = (n: number) => n.toString(16).padStart(24, '0');
const at = '2026-10-22T00:00:00.000Z';
const item = (n: number) => ({
  concept: {
    id: id(n),
    title: 'A concept',
    slug: 'a-concept',
    difficulty: 'BEGINNER' as const,
  },
  activity: {
    conceptId: id(n),
    status: 'IN_PROGRESS' as const,
    attemptCount: 1,
    startedAt: at,
    lastActivityAt: at,
  },
  mastery: {
    status: 'UNAVAILABLE' as const,
    result: null,
    unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE' as const,
  },
});
async function fixture(
  options: {
    count?: number;
    ip?: number;
    student?: number;
    capacity?: number;
    unavailable?: boolean;
  } = {},
) {
  const tokens = createAccessTokens(env);
  const state = {
    reads: 0,
    finishes: 0,
    eligible: true,
    failure: undefined as Error | undefined,
    override: undefined as unknown,
    boundaryFailure: undefined as Error | undefined,
    owners: [] as string[],
  };
  // Trusted OFFLINE repository adapter: route tests never connect to MongoDB.
  const repository: DashboardRepository = {
    async discover(owner, query) {
      state.reads++;
      state.owners.push(owner);
      if (state.failure) throw state.failure;
      if (!state.eligible)
        throw new AppError(403, 'AUTH_FORBIDDEN', 'private account state');
      const visible = Array.from(
        { length: options.count ?? 1 },
        (_, i) => item(i + 10).concept,
      ).filter((c) => !query.cursor || c.id > query.cursor);
      if (visible.length > query.limit)
        return {
          concepts: visible.slice(0, query.limit),
          pagination: {
            limit: query.limit,
            nextCursor: visible[query.limit - 1]!.id,
          },
        };
      return {
        concepts: visible,
        pagination: { limit: query.limit, nextCursor: null },
      };
    },
    async activity(_owner, concepts) {
      if (options.unavailable)
        throw new AppError(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'private source failure',
        );
      return concepts.map((concept) => ({
        ...item(parseInt(concept.id, 16)),
        context: { identity: 'offline', origin: null },
      }));
    },
    async finish() {
      state.finishes++;
    },
  };
  const reader = createDashboardService(tokens, env, repository);
  const args: Parameters<typeof createApp> = [];
  args[26] = {
    async read(input) {
      if (state.boundaryFailure) throw state.boundaryFailure;
      return state.override === undefined
        ? reader.read(input)
        : (state.override as DashboardData);
    },
  };
  args[27] = {
    ...dashboardLimitDefaults,
    ip: options.ip ?? 100,
    student: options.student ?? 20,
    capacity: options.capacity ?? 10000,
  };
  const server = createApp(...args).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api/v1';
  const claims = {
    sub: id(1),
    sid: id(2),
    role: 'STUDENT' as const,
    plan: 'FREE' as const,
  };
  const token = await tokens.sign(claims);
  return {
    state,
    tokens,
    claims,
    base,
    token,
    get: (
      query = '',
      authorization: string | null = token,
      init: RequestInit = {},
    ) =>
      fetch(base + '/dashboard' + query, {
        ...init,
        headers: {
          ...(authorization === null
            ? {}
            : { Authorization: 'Bearer ' + authorization }),
          ...init.headers,
        },
      }),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((e) => (e ? reject(e) : resolve()));
      }),
  };
}
async function error(
  response: globalThis.Response,
  status: number,
  code: string,
) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(
    response.headers.get('content-type') ?? '',
    /^application\/json/,
  );
  const body = (await response.json()) as {
    success: boolean;
    error: { code: string };
    meta: object;
  };
  assert.equal(body.success, false);
  assert.equal(body.error.code, code);
  assert.deepEqual(Object.keys(body.meta), ['requestId']);
  assert(!JSON.stringify(body).includes('private'));
}
test('dashboard Student success is exact, self-only, no-store and read-only', async () => {
  const f = await fixture();
  try {
    const response = await f.get();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(response.headers.get('content-type')!, /^application\/json/);
    const body = (await response.json()) as {
      success: boolean;
      data: DashboardData;
      message: null;
      meta: object;
    };
    assert.deepEqual(Object.keys(body).sort(), [
      'data',
      'message',
      'meta',
      'success',
    ]);
    assert.equal(body.success, true);
    assert.equal(body.message, null);
    assert.deepEqual(body.data, {
      items: [item(10)],
      pagination: { limit: 5, nextCursor: null },
    });
    assert.deepEqual(f.state.owners, [id(1)]);
    assert.equal(f.state.finishes, 1);
    assert(
      !/answer|rubric|score|userId|sessionId|completedAt/.test(
        JSON.stringify(body.data),
      ),
    );
  } finally {
    await f.close();
  }
});
test('empty dashboard uses proven empty DTO', async () => {
  const f = await fixture({ count: 0 });
  try {
    assert.deepEqual(
      ((await (await f.get()).json()) as { data: DashboardData }).data,
      {
        items: [],
        pagination: { limit: 5, nextCursor: null },
      },
    );
  } finally {
    await f.close();
  }
});
test('canonical limit and exclusive cursor reach the unchanged reader', async () => {
  const f = await fixture({ count: 3 });
  try {
    const first = (
      (await (await f.get('?limit=1')).json()) as { data: DashboardData }
    ).data;
    assert.equal(first.items[0]!.concept.id, id(10));
    assert.equal(first.pagination.nextCursor, id(10));
    const next = (
      (await (
        await f.get('?limit=2&cursor=' + first.pagination.nextCursor)
      ).json()) as { data: DashboardData }
    ).data;
    assert.deepEqual(
      next.items.map((i) => i.concept.id),
      [id(11), id(12)],
    );
    assert.equal(next.pagination.nextCursor, null);
  } finally {
    await f.close();
  }
});
for (const [name, query] of Object.entries({
  unknown: '?studentId=' + id(3),
  role: '?role=STUDENT',
  duplicate: '?limit=1&limit=1',
  blank: '?limit=',
  zero: '?limit=0',
  maximum: '?limit=6',
  padded: '?limit=01',
  decimal: '?limit=1.0',
  array: '?limit[]=1',
  object: '?limit[x]=1',
  cursorCase: '?cursor=' + 'A'.repeat(24),
  cursorDuplicate: '?cursor=' + id(2) + '&cursor=' + id(2),
  cursorBlank: '?cursor=',
  cursorShort: '?cursor=a',
  score: '?score=100',
})) {
  test('strict query refuses ' + name, async () => {
    const f = await fixture();
    try {
      await error(await f.get(query), 400, 'VALIDATION_ERROR');
      assert.equal(f.state.reads, 0);
    } finally {
      await f.close();
    }
  });
}
test('missing, invalid and expired authentication refuses before reading', async () => {
  const f = await fixture();
  try {
    await error(await f.get('', null), 401, 'AUTH_ACCESS_TOKEN_MISSING');
    await error(await f.get('', 'invalid'), 401, 'AUTH_ACCESS_TOKEN_INVALID');
    const expired = await createAccessTokens(
      env,
      () => new Date(Date.now() - 1000000),
    ).sign(f.claims);
    await error(await f.get('', expired), 401, 'AUTH_ACCESS_TOKEN_EXPIRED');
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
test('Admin cannot invoke the reader', async () => {
  const f = await fixture();
  try {
    await error(
      await f.get('', await f.tokens.sign({ ...f.claims, role: 'ADMIN' })),
      403,
      'AUTH_FORBIDDEN',
    );
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
for (const reason of ['inactive', 'unverified'])
  test(reason + ' current Student refuses', async () => {
    const f = await fixture();
    try {
      f.state.eligible = false;
      await error(await f.get(), 403, 'AUTH_FORBIDDEN');
    } finally {
      await f.close();
    }
  });
test('uncertain publication or classification returns sanitized 503, never partial data', async () => {
  const f = await fixture({ unavailable: true });
  try {
    await error(await f.get(), 503, 'DEPENDENCY_UNAVAILABLE');
  } finally {
    await f.close();
  }
});
test('unexpected reader error remains sanitized 500', async () => {
  const f = await fixture();
  try {
    f.state.boundaryFailure = new Error('private stack');
    await error(await f.get(), 500, 'INTERNAL_ERROR');
  } finally {
    await f.close();
  }
});
test('DTO boundary refuses private or contradictory service output', async () => {
  const f = await fixture();
  try {
    for (const data of [
      {
        items: [{ ...item(10), answer: 'private' }],
        pagination: { limit: 5, nextCursor: null },
      },
      { items: [], pagination: { limit: 5, nextCursor: id(10) } },
    ]) {
      f.state.override = data;
      await error(await f.get(), 503, 'DEPENDENCY_UNAVAILABLE');
    }
  } finally {
    await f.close();
  }
});
for (const result of [
  { classification: 'WEAK', code: 'NONE' },
  { classification: 'IMPROVING', code: 'NONE' },
  { classification: 'STRONG', code: 'NONE' },
  { classification: 'UNCLASSIFIED', code: 'SCORE_MISSING' },
  { classification: 'UNCLASSIFIED', code: 'STALE_ASSESSMENT' },
  { classification: 'UNCLASSIFIED', code: 'REVOKED_ASSESSMENT' },
] as const)
  test(
    'HTTP preserves trusted F039 ' + result.classification + '/' + result.code,
    async () => {
      const f = await fixture();
      try {
        const entry = {
          ...item(10),
          mastery: { status: 'EVALUATED', result, unavailableCode: null },
        };
        f.state.override = {
          items: [entry],
          pagination: { limit: 5, nextCursor: null },
        };
        const response = await f.get();
        assert.equal(response.status, 200);
        const body = (await response.json()) as { data: DashboardData };
        assert.deepEqual(body.data.items[0]!.mastery, entry.mastery);
        assert.deepEqual(Object.keys(body.data.items[0]!.mastery.result!), [
          'classification',
          'code',
        ]);
      } finally {
        await f.close();
      }
    },
  );
test('HEAD and other methods never execute GET; existing preflight and health work', async () => {
  const f = await fixture();
  try {
    for (const method of ['HEAD', 'POST', 'PUT', 'DELETE']) {
      const response = await f.get('', f.token, { method });
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    const preflight = await f.get('', null, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:3000',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get('access-control-allow-credentials'),
      null,
    );
    assert.equal((await fetch(f.base + '/health')).status, 200);
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
test('CORS and early parser errors retain no-store and existing error contracts', async () => {
  const f = await fixture();
  try {
    await error(
      await f.get('', f.token, {
        headers: { Origin: 'https://unapproved.invalid' },
      }),
      403,
      'ORIGIN_NOT_ALLOWED',
    );
    for (const [body, contentType, status, code] of [
      ['{', 'application/json', 400, 'VALIDATION_ERROR'],
      ['x'.repeat(270000), 'application/json', 413, 'PAYLOAD_TOO_LARGE'],
      [
        '{}',
        'application/json; charset=unsupported',
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      ],
    ] as const)
      await error(
        await f.get('', f.token, {
          method: 'POST',
          body,
          headers: { 'Content-Type': contentType },
        }),
        status,
        code,
      );
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
test('GET refuses JSON, non-JSON and transfer-encoded bodies', async () => {
  const f = await fixture();
  try {
    for (const headers of [
      { 'Content-Length': '2', 'Content-Type': 'application/json' },
      { 'Content-Length': '2', 'Content-Type': 'text/plain' },
      { 'Transfer-Encoding': 'chunked' },
    ]) {
      const result = await new Promise<{
        status: number;
        cache: string | undefined;
      }>((resolve, reject) => {
        const req = request(
          f.base + '/dashboard',
          {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + f.token, ...headers },
          },
          (res) => {
            res.resume();
            res.on('end', () =>
              resolve({
                status: res.statusCode!,
                cache: res.headers['cache-control'],
              }),
            );
          },
        );
        req.on('error', reject);
        req.end('{}');
      });
      assert.equal(result.status, 400);
      assert.equal(result.cache, 'no-store');
    }
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
test('Student counters are isolated; rate denial supplies Retry-After and no identity', async () => {
  const f = await fixture({ student: 1 });
  try {
    assert.equal((await f.get()).status, 200);
    const denied = await f.get();
    assert(Number(denied.headers.get('retry-after')) > 0);
    assert(denied.headers.has('ratelimit'));
    assert(!denied.headers.has('x-ratelimit-limit'));
    await error(denied, 429, 'RATE_LIMIT_EXCEEDED');
    const other = await f.tokens.sign({ ...f.claims, sub: id(3) });
    assert.equal((await f.get('', other)).status, 200);
    assert.deepEqual(f.state.owners, [id(1), id(3)]);
  } finally {
    await f.close();
  }
});
test('IP guard counts unauthenticated requests before authentication', async () => {
  const f = await fixture({ ip: 1 });
  try {
    await error(await f.get('', null), 401, 'AUTH_ACCESS_TOKEN_MISSING');
    await error(await f.get(), 429, 'RATE_LIMIT_EXCEEDED');
    assert.equal(f.state.reads, 0);
  } finally {
    await f.close();
  }
});
test('exhausted Student store refuses new identity without evicting live counters', async () => {
  const f = await fixture({ capacity: 1 });
  try {
    assert.equal((await f.get()).status, 200);
    await error(
      await f.get('', await f.tokens.sign({ ...f.claims, sub: id(3) })),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    assert.equal((await f.get()).status, 200);
  } finally {
    await f.close();
  }
});
test('bounded store expires only elapsed counters and keeps windows per identity', async () => {
  let now = 0;
  const store = createDashboardLimitStore(2, 100, () => now);
  assert.equal((await store.increment('a')).totalHits, 1);
  now = 50;
  assert.equal((await store.increment('b')).totalHits, 1);
  assert.throws(
    () => store.increment('c'),
    /Dashboard is temporarily unavailable/,
  );
  now = 100;
  assert.equal((await store.increment('c')).totalHits, 1);
  assert.equal((await store.increment('b')).totalHits, 2);
  assert.throws(
    () => store.increment('a'),
    /Dashboard is temporarily unavailable/,
  );
});
test('unknown IP and missing authenticated identity refuse without creating shared fallback keys', async () => {
  const limits = createDashboardRateLimits();
  for (const middleware of [limits.ip, limits.student]) {
    const caught = await new Promise<unknown>((resolve) => {
      void middleware(
        { headers: {}, app: { get: () => false } } as unknown as Request,
        {} as Response,
        resolve,
      );
    });
    assert(caught instanceof AppError);
    assert.equal(caught.statusCode, 503);
  }
});
test('non-LOCAL application does not mount the endpoint', async () => {
  const previous = env.APP_ENV;
  env.APP_ENV = 'DEVELOPMENT';
  const args: Parameters<typeof createApp> = [];
  let called = false;
  args[26] = {
    async read() {
      called = true;
      throw new Error('unreachable');
    },
  };
  const server = createApp(...args).listen(0, '127.0.0.1');
  env.APP_ENV = previous;
  await once(server, 'listening');
  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetch(
      'http://127.0.0.1:' + address.port + '/api/v1/dashboard',
    );
    await error(response, 404, 'ROUTE_NOT_FOUND');
    assert.equal(called, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test('prepared integration import is inert and has its own fixed manifest and existing index allowlist', async () => {
  const { mongoose } = await import('../src/config/database.js');
  assert.equal(mongoose.connection.readyState, 0);
  const prepared = await import('./dashboard.integration.js');
  assert.equal(mongoose.connection.readyState, 0);
  assert.deepEqual(prepared.dashboardIntegrationRecords, [
    'PARENT',
    'T01',
    'T02',
    'T03',
    'T04',
    'T05',
    'T06',
    'T07',
    'T08',
  ]);
  assert.equal(prepared.dashboardIntegrationIndexes.length, 21);
  assert.equal(prepared.dashboardIntegrationCollections.length, 8);
  assert.equal(prepared.dashboardIntegrationTimeoutMs, 180000);
  assert.equal(typeof prepared.runDashboardIntegration, 'function');
});
