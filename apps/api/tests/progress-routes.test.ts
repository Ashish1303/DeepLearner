import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createProgressService } from '../src/modules/progress/progress.service.js';
import type { UserDto } from '../src/modules/users/user.dto.js';
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
const id = 'a'.repeat(24),
  data = {
    conceptId: id,
    status: 'NOT_STARTED' as const,
    attemptCount: 0,
    startedAt: null,
    lastActivityAt: null,
  };
async function fixture(limit = 120) {
  let reads = 0,
    failure: Error | undefined,
    current = {
      id,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
    } as UserDto;
  const service = createProgressService(
    {
      async read(owner, concept) {
        reads++;
        assert.equal(owner, id);
        assert.equal(concept, id);
        if (failure) throw failure;
        return data;
      },
    },
    {
      async get() {
        return current;
      },
    },
  );
  const args: Parameters<typeof createApp> = [];
  args[23] = service;
  args[24] = { get: limit, ip: 300, windowMs: 900000 };
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
  const base = 'http://127.0.0.1:' + address.port + '/api/v1';
  return {
    url: base + '/progress?conceptId=' + id,
    base,
    token,
    tokens,
    reads: () => reads,
    fail: (e: Error) => {
      failure = e;
    },
    setUser: (value: UserDto) => {
      current = value;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
test('Student progress exact envelope is private, no-store and owner-scoped; anonymous/Admin rejected', async () => {
  const f = await fixture();
  try {
    for (const auth of [
      undefined,
      'invalid',
      await f.tokens.sign({ sub: id, sid: id, role: 'ADMIN', plan: 'FREE' }),
    ]) {
      const response = await fetch(f.url, {
        headers: auth ? { Authorization: 'Bearer ' + auth } : {},
      });
      assert([401, 403].includes(response.status));
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal(f.reads(), 0);
    const response = await fetch(f.url, {
        headers: { Authorization: 'Bearer ' + f.token },
      }),
      body = (await response.json()) as {
        data: typeof data;
        meta: Record<string, unknown>;
      };
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(body.data, data);
    assert.deepEqual(Object.keys(body.meta), ['requestId']);
    assert.equal(f.reads(), 1);
    for (const key of [
      'answer',
      'studentAnswer',
      'userId',
      'score',
      'mastery',
      'completedAt',
      'contentFingerprint',
    ])
      assert(!Object.hasOwn(body.data, key));
  } finally {
    await f.close();
  }
});
test('strict query and GET bodies reject before progress reads', async () => {
  const f = await fixture();
  try {
    for (const query of [
      '',
      '?conceptId=x',
      '?conceptId=' + id + '&conceptId=' + id,
      '?conceptId=' + id + '&userId=' + id,
      '?conceptId[x]=' + id,
    ]) {
      const r = await fetch(f.base + '/progress' + query, {
        headers: { Authorization: 'Bearer ' + f.token },
      });
      assert.equal(r.status, 400);
      assert.equal(r.headers.get('cache-control'), 'no-store');
    }
    for (const contentType of ['application/json', 'text/plain']) {
      const result = await new Promise<number>((resolve, reject) => {
        const r = request(
          f.url,
          {
            method: 'GET',
            headers: {
              Authorization: 'Bearer ' + f.token,
              'Content-Type': contentType,
              'Content-Length': '2',
            },
          },
          (res) => {
            res.resume();
            res.on('end', () => resolve(res.statusCode!));
          },
        );
        r.on('error', reject);
        r.end('{}');
      });
      assert.equal(result, 400);
    }
    assert.equal(f.reads(), 0);
  } finally {
    await f.close();
  }
});
test('matching early parser/CORS errors are no-store; unrelated paths keep existing behavior', async () => {
  const f = await fixture();
  try {
    const cors = await fetch(f.url, {
      headers: { Origin: 'https://unapproved.invalid' },
    });
    assert.equal(cors.status, 403);
    assert.equal(cors.headers.get('cache-control'), 'no-store');
    const result = await new Promise<{
      status: number;
      cache: string | undefined;
    }>((resolve, reject) => {
      const r = request(
        f.url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '1',
          },
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
      r.on('error', reject);
      r.end('{');
    });
    assert.equal(result.status, 400);
    assert.equal(result.cache, 'no-store');
    const unrelated = await fetch(f.base + '/progress-other');
    assert.equal(unrelated.status, 404);
    assert.notEqual(unrelated.headers.get('cache-control'), 'no-store');
  } finally {
    await f.close();
  }
});
test('index/integrity failure stays sanitized 503 and never returns fabricated zero', async () => {
  const f = await fixture();
  try {
    f.fail(
      new AppError(
        503,
        'DEPENDENCY_UNAVAILABLE',
        'Activity is temporarily unavailable',
      ),
    );
    const response = await fetch(f.url, {
        headers: { Authorization: 'Bearer ' + f.token },
      }),
      body = (await response.json()) as {
        error: { code: string };
        data: unknown;
      };
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(body.error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.equal(body.data, undefined);
    assert.deepEqual(Object.keys(body).sort(), ['error', 'meta', 'success']);
    assert(!JSON.stringify(body).includes('stack'));
  } finally {
    await f.close();
  }
});
test('progress rate limiting preserves safe 429/no-store behavior', async () => {
  const f = await fixture(1);
  try {
    const headers = { Authorization: 'Bearer ' + f.token };
    assert.equal((await fetch(f.url, { headers })).status, 200);
    const response = await fetch(f.url, { headers });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(f.reads(), 1);
  } finally {
    await f.close();
  }
});
test('Slice 2 completion routing does not consume the existing activity service or change its envelope', async () => {
  const f = await fixture();
  try {
    const headers = { Authorization: 'Bearer ' + f.token };
    const invalid = await fetch(
      f.base + '/progress/completion?conceptId=invalid',
      { headers },
    );
    assert.equal(invalid.status, 400);
    assert.equal(f.reads(), 0);
    const activity = await fetch(f.url, { headers });
    assert.equal(activity.status, 200);
    const body = (await activity.json()) as { data: typeof data };
    assert.deepEqual(body.data, data);
    assert.equal(Object.keys(body.data).length, 5);
    assert.equal(f.reads(), 1);
  } finally {
    await f.close();
  }
});
