import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { test } from 'node:test';
import { createPracticeService } from '../src/modules/practice/practice.service.js';
import type { UserDto } from '../src/modules/users/user.dto.js';
import { AppError } from '../src/common/errors/app-error.js';
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
type Body = {
  data: Record<string, unknown>[];
  meta: Record<string, unknown>;
  error: { code: string; stack?: string };
};
const id = 'a'.repeat(24);
const user: UserDto = {
  id,
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'test@example.invalid',
  emailVerified: true,
  status: 'ACTIVE',
  role: 'STUDENT',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: new Date().toISOString(),
};
async function fixture(max = 120, ip = 300) {
  let reads = 0;
  let failure: AppError | undefined;
  const service = createPracticeService(
    {
      async list(query) {
        reads++;
        if (failure) throw failure;
        return {
          items: [
            {
              id,
              conceptId: id,
              type: query.type,
              difficulty: 'BEGINNER',
              prompt: 'Predict',
              starterCode: null,
              language: null,
            },
          ],
          total: 1,
        };
      },
    },
    {
      async get() {
        return user;
      },
    },
  );
  const args: Parameters<typeof createApp> = [];
  args[21] = service;
  args[22] = { get: max, ip, windowMs: 900000 };
  const server = createApp(...args).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const tokens = createAccessTokens(env);
  const token = await tokens.sign({
    sub: id,
    sid: id,
    role: 'STUDENT',
    plan: 'FREE',
  });
  return {
    url: `http://127.0.0.1:${address.port}/api/v1/practice-questions`,
    token,
    tokens,
    reads: () => reads,
    fail: (value: AppError) => {
      failure = value;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
test('protected HTTP denies missing/invalid/expired/admin tokens before content and returns exact safe envelope', async () => {
  const f = await fixture();
  try {
    const expired = await createAccessTokens(
      env,
      () => new Date(Date.now() - 1000000),
    ).sign({ sub: id, sid: id, role: 'STUDENT', plan: 'FREE' });
    const admin = await f.tokens.sign({
      sub: id,
      sid: id,
      role: 'ADMIN',
      plan: 'FREE',
    });
    for (const [token, status] of [
      ['', 401],
      ['invalid', 401],
      [expired, 401],
      [admin, 403],
    ] as const) {
      for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']) {
        const r = await fetch(f.url + '?conceptId=' + id + '&type=' + type, {
          headers: token ? { Authorization: 'Bearer ' + token } : {},
        });
        assert.equal(r.status, status);
      }
    }
    assert.equal(f.reads(), 0);
    const r = await fetch(f.url + '?conceptId=' + id, {
      headers: {
        Authorization: 'Bearer ' + f.token,
        Origin: 'http://127.0.0.1:3000',
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal(r.headers.get('set-cookie'), null);
    assert.equal(r.headers.get('access-control-allow-credentials'), null);
    const body = (await r.json()) as Body;
    assert.deepEqual(
      Object.keys(body.data[0]!).sort(),
      [
        'id',
        'conceptId',
        'type',
        'difficulty',
        'prompt',
        'starterCode',
        'language',
      ].sort(),
    );
    assert.deepEqual(body.meta, {
      requestId: r.headers.get('x-request-id'),
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  } finally {
    await f.close();
  }
});
test('HTTP rejects duplicated/unknown query keys, disallowed origin and unsupported methods', async () => {
  const f = await fixture();
  try {
    for (const query of [
      '',
      `conceptId=${id}&conceptId=${id}`,
      `conceptId=${id}&answer=1`,
      `conceptId=${id}&type=OUTPUT&type=DESCRIPTIVE`,
      `conceptId=${id}&type[x]=OUTPUT`,
      `conceptId=${id}&type=CODING_BASED`,
      `conceptId=${id}&type=SCENARIO_BASED`,
      `conceptId=${id}&type=SCENARIO&type=OUTPUT`,
      `conceptId=${id}&type=`,
      `conceptId=${id}&limit=21`,
      `conceptId=${id}&page=01`,
      `conceptId=${id}&conceptId[x]=1`,
    ]) {
      const r = await fetch(f.url + '?' + query, {
        headers: { Authorization: 'Bearer ' + f.token },
      });
      assert.equal(r.status, 400);
      assert.equal(((await r.json()) as Body).error.code, 'VALIDATION_ERROR');
    }
    assert.equal(f.reads(), 0);
    assert.equal(
      (
        await fetch(f.url + '?conceptId=' + id, {
          headers: {
            Authorization: 'Bearer ' + f.token,
            Origin: 'https://evil.invalid',
          },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(f.url, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + f.token },
        })
      ).status,
      404,
    );
  } finally {
    await f.close();
  }
});
test('subject and IP limiters return standard safe errors without subject leakage', async () => {
  for (const [max, ip] of [
    [1, 300],
    [120, 1],
  ]) {
    const f = await fixture(max, ip);
    try {
      const request = (type = 'OUTPUT') =>
        fetch(f.url + '?conceptId=' + id + '&type=' + type, {
          headers: { Authorization: 'Bearer ' + f.token },
        });
      assert.equal((await request()).status, 200);
      const r = await request('DESCRIPTIVE');
      assert.equal(r.status, 429);
      assert(r.headers.get('ratelimit'));
      assert.equal(
        ((await r.json()) as Body).error.code,
        'RATE_LIMIT_EXCEEDED',
      );
      assert.equal(f.reads(), 1);
      assert.equal((await request('SCENARIO')).status, 429);
      assert.equal((await request('CODING')).status, 429);
      assert.equal(f.reads(), 1);
    } finally {
      await f.close();
    }
  }
});
test('HTTP preserves existing unavailable/hidden error contracts', async () => {
  const f = await fixture();
  try {
    for (const [status, code] of [
      [404, 'CONCEPT_NOT_FOUND'],
      [503, 'DEPENDENCY_UNAVAILABLE'],
    ] as const) {
      f.fail(new AppError(status, code, 'Safe message'));
      for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']) {
        const r = await fetch(f.url + '?conceptId=' + id + '&type=' + type, {
          headers: { Authorization: 'Bearer ' + f.token },
        });
        assert.equal(r.status, status);
        const body = (await r.json()) as Body;
        assert.equal(body.error.code, code);
        assert.equal(body.error.stack, undefined);
      }
    }
  } finally {
    await f.close();
  }
});

test('GET rejects non-JSON and chunked request bodies before content reads', async () => {
  const f = await fixture();
  try {
    for (const chunked of [false, true]) {
      const status = await new Promise<number | undefined>(
        (resolve, reject) => {
          const req = request(
            f.url + '?conceptId=' + id,
            {
              method: 'GET',
              headers: {
                Authorization: 'Bearer ' + f.token,
                'Content-Type': 'text/plain',
                ...(chunked
                  ? { 'Transfer-Encoding': 'chunked' }
                  : { 'Content-Length': '4' }),
              },
            },
            (res) => {
              res.resume();
              res.on('end', () => resolve(res.statusCode));
            },
          );
          req.on('error', reject);
          req.end('data');
        },
      );
      assert.equal(status, 400);
    }
    assert.equal(f.reads(), 0);
  } finally {
    await f.close();
  }
});

test('F032/F033 HTTP defaults OUTPUT and returns each explicit type with seven safe fields', async () => {
  const f = await fixture();
  try {
    for (const type of ['', 'OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']) {
      const response = await fetch(
        f.url + '?conceptId=' + id + (type ? '&type=' + type : ''),
        { headers: { Authorization: 'Bearer ' + f.token } },
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as Body;
      assert.equal(body.data[0]!.type, type || 'OUTPUT');
      assert.equal(Object.keys(body.data[0]!).length, 7);
      assert.deepEqual(
        Object.keys(body.data[0]!).sort(),
        [
          'id',
          'conceptId',
          'type',
          'difficulty',
          'prompt',
          'starterCode',
          'language',
        ].sort(),
      );
      assert.doesNotMatch(
        JSON.stringify(body),
        /answer|explanation|evaluation|createdBy/,
      );
    }
  } finally {
    await f.close();
  }
});
