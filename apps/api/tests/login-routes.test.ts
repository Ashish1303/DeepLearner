import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { z } from 'zod';
import { AppError } from '../src/common/errors/app-error.js';
import type { LoginService } from '../src/modules/auth/login.service.js';

process.env.APP_ENV = 'LOCAL';
process.env.EMAIL_PROVIDER = 'disabled';
process.env.LOG_LEVEL = 'silent';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = 'deeplearner-test';
process.env.ACCESS_TOKEN_SECRET = Buffer.from(
  Array.from({ length: 32 }, (_, i) => i + 1),
).toString('base64');
process.env.ACCESS_TOKEN_ISSUER = 'test';
process.env.ACCESS_TOKEN_AUDIENCE = 'test';
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.CORS_ORIGINS = 'http://127.0.0.1:3000';
const { createApp } = await import('../src/app.js');
const { mongoose } = await import('../src/config/database.js');
test('login/refresh HTTP contracts, scoped CORS, strict Origin, safe errors and unchanged health', async () => {
  let calls = 0;
  let failure = '';
  const service: LoginService = {
    async login(input) {
      calls++;
      assert.equal(input.email, 'synthetic@example.com');
      if (failure) throw new AppError(401, failure, 'Invalid credentials');
      return {
        accessToken: 'access',
        expiresInSeconds: 900,
        refreshToken: 'PRIVATE_REFRESH',
        expiresAt: new Date(Date.now() + 30000),
        user: {
          id: 'a'.repeat(24),
          email: input.email,
          firstName: 'Test',
          lastName: 'User',
          role: 'STUDENT',
          plan: 'FREE',
          status: 'ACTIVE',
        },
      };
    },
    async refresh(raw) {
      assert.equal(raw, 'PRIVATE_REFRESH');
      if (failure) throw new AppError(401, failure, 'Invalid refresh');
      return {
        accessToken: 'replacement',
        expiresInSeconds: 900,
        refreshToken: 'PRIVATE_REPLACEMENT',
        expiresAt: new Date(Date.now() + 20000),
      };
    },
  };
  const limits = {
    AUTH_LOGIN_LIMIT: 100,
    AUTH_LOGIN_WINDOW_MS: 60000,
    AUTH_LOGIN_IP_LIMIT: 100,
    AUTH_LOGIN_IP_WINDOW_MS: 60000,
    AUTH_REFRESH_LIMIT: 100,
    AUTH_REFRESH_WINDOW_MS: 60000,
  };
  const server = createApp(undefined, undefined, service, limits).listen(
    0,
    '127.0.0.1',
  );
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (
    route: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(`${base}/api/v1/auth/${route}`, {
      method: 'POST',
      headers: {
        Origin: 'http://127.0.0.1:3000',
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    const input = {
      email: ' Synthetic@Example.com ',
      password: 'synthetic-password',
    };
    assert.equal((await post('login', input, { Origin: 'null' })).status, 403);
    assert.equal(
      (await post('login', { ...input, role: 'ADMIN' })).status,
      400,
    );
    assert.equal((await post('login', { ...input, password: '' })).status, 400);
    assert.equal(calls, 0);
    const response = await post('login', input);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('access-control-allow-credentials'),
      'true',
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert(response.headers.get('set-cookie')!.startsWith('dl_refresh='));
    const text = await response.text();
    assert(!text.includes('PRIVATE'));
    assert.equal(JSON.parse(text).message, 'Login successful');
    const refresh = await post('refresh', undefined, {
      Cookie: 'dl_refresh=PRIVATE_REFRESH',
    });
    assert.equal(refresh.status, 200);
    const refreshed = z
      .object({
        data: z.object({
          accessToken: z.string(),
          expiresInSeconds: z.number(),
        }),
        message: z.null(),
      })
      .parse(await refresh.json());
    assert.deepEqual(refreshed.data, {
      accessToken: 'replacement',
      expiresInSeconds: 900,
    });
    assert.equal(refreshed.message, null);
    assert.equal((await post('refresh')).status, 401);
    failure = 'AUTH_REFRESH_TOKEN_REUSED';
    const reused = await post(
      'refresh',
      {},
      { Cookie: 'dl_refresh=PRIVATE_REFRESH' },
    );
    assert.equal(reused.status, 401);
    assert.equal(
      z
        .object({ error: z.object({ code: z.string() }) })
        .parse(await reused.json()).error.code,
      failure,
    );
    assert(reused.headers.get('set-cookie')!.includes('Max-Age=0'));
    const preflight = await fetch(`${base}/api/v1/auth/refresh`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(
      preflight.headers.get('access-control-allow-credentials'),
      'true',
    );
    const health = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-credentials'), null);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
