import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { z } from 'zod';
import { AppError } from '../src/common/errors/app-error.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import type { PasswordRecoveryService } from '../src/modules/auth/password-recovery.service.js';
Object.assign(process.env, {
  APP_ENV: 'LOCAL',
  EMAIL_PROVIDER: 'disabled',
  LOG_LEVEL: 'silent',
  MONGODB_URI: 'mongodb://127.0.0.1:27017',
  MONGODB_DB_NAME: 'deeplearner-test',
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
const { mongoose } = await import('../src/config/database.js');
test('F010 HTTP contracts, generic forgot, trusted JWT identity, strict Origin, scoped cookies and safe dependency errors', async () => {
  let fail = false,
    calls = 0;
  const id = 'a'.repeat(24),
    sid = 'b'.repeat(24);
  const service: PasswordRecoveryService = {
    async forgot(email) {
      calls++;
      assert.equal(email, 'synthetic@example.com');
      if (fail)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
    async reset() {
      calls++;
      if (fail)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
    async change(userId, sessionId) {
      calls++;
      assert.equal(userId, id);
      assert.equal(sessionId, sid);
      if (fail)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
  };
  const limits = {
    AUTH_FORGOT_LIMIT: 100,
    AUTH_FORGOT_WINDOW_MS: 60000,
    AUTH_RESET_LIMIT: 100,
    AUTH_RESET_WINDOW_MS: 60000,
    AUTH_CHANGE_LIMIT: 100,
    AUTH_CHANGE_WINDOW_MS: 60000,
    AUTH_CHANGE_IP_LIMIT: 100,
    AUTH_CHANGE_IP_WINDOW_MS: 60000,
  };
  const server = createApp(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
    limits,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const jwt = await createAccessTokens(env).sign({
    sub: id,
    sid,
    role: 'STUDENT',
    plan: 'FREE',
  });
  const post = (
    route: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(`${base}/api/v1/auth/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://127.0.0.1:3000',
        ...headers,
      },
      body: JSON.stringify(body),
    });
  const reset = { token: 'synthetic-token', newPassword: 'new-password' },
    change = { currentPassword: 'old-password', newPassword: 'new-password' };
  try {
    for (const route of ['reset-password', 'change-password']) {
      for (const Origin of ['null', 'https://unapproved.example', 'malformed'])
        assert.equal((await post(route, {}, { Origin })).status, 403);
      assert.equal(
        (await fetch(`${base}/api/v1/auth/${route}`, { method: 'POST' }))
          .status,
        403,
      );
    }
    assert.equal(calls, 0);
    const forgot = await post('forgot-password', {
      email: ' Synthetic@Example.com ',
    });
    assert.equal(forgot.status, 202);
    const body = z
      .object({
        success: z.literal(true),
        data: z.null(),
        message: z.string(),
        meta: z.object({ requestId: z.string() }),
      })
      .parse(await forgot.json());
    assert(body.message.includes('will be requested'));
    assert.equal(forgot.headers.get('set-cookie'), null);
    assert.equal(forgot.headers.get('access-control-allow-credentials'), null);
    assert.equal(
      (
        await post('forgot-password', {
          email: 'synthetic@example.com',
          role: 'ADMIN',
        })
      ).status,
      400,
    );
    assert.equal(
      (await post('reset-password', { ...reset, userId: id })).status,
      400,
    );
    assert.equal((await post('change-password', change)).status, 401);
    const authorization = { Authorization: `Bearer ${jwt}` };
    assert.equal(
      (await post('change-password', { ...change, userId: id }, authorization))
        .status,
      400,
    );
    for (const [route, input] of [
      ['reset-password', reset],
      ['change-password', change],
    ] as const) {
      const response = await post(route, input, authorization);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const text = await response.text();
      assert(!text.includes('new-password'));
      assert(!text.includes(jwt));
      if (route === 'reset-password') {
        assert(response.headers.get('set-cookie')!.includes('Max-Age=0'));
        assert.equal(
          response.headers.get('access-control-allow-credentials'),
          'true',
        );
      } else {
        assert.equal(response.headers.get('set-cookie'), null);
        assert.equal(
          response.headers.get('access-control-allow-credentials'),
          null,
        );
      }
    }
    fail = true;
    for (const [route, input] of [
      ['forgot-password', { email: 'synthetic@example.com' }],
      ['reset-password', reset],
      ['change-password', change],
    ] as const) {
      const response = await post(route, input, authorization);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('set-cookie'), null);
      assert((await response.text()).includes('DEPENDENCY_UNAVAILABLE'));
    }
    assert.equal((await post('set-password', {})).status, 404);
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
