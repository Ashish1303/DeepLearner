import { z } from 'zod';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createLogoutService } from '../src/modules/auth/logout.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { issueRefreshSecret } from '../src/modules/auth/refresh-token.service.js';
import { clearRefreshCookie } from '../src/modules/auth/refresh-cookie.js';
import express from 'express';

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
const { env } = await import('../src/config/env.js');
const { mongoose } = await import('../src/config/database.js');

test('logout HTTP contracts, strict Origin/CORS, JWT ownership, safe failures and cookie clearing', async () => {
  let calls = 0;
  let failure = false;
  const id = 'a'.repeat(24);
  const token = `${'b'.repeat(24)}.${issueRefreshSecret().secret}`;
  const service = createLogoutService({
    async logout() {
      calls++;
      if (failure)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
    },
    async logoutAll(input) {
      calls++;
      assert.equal(input.userId, id);
      if (failure)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
      return 2;
    },
  });
  const server = createApp(
    undefined,
    undefined,
    undefined,
    undefined,
    service,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const tokens = createAccessTokens(env);
  const jwt = await tokens.sign({
    sub: id,
    sid: 'b'.repeat(24),
    role: 'STUDENT',
    plan: 'FREE',
  });
  const post = (
    route: string,
    headers: Record<string, string> = {},
    body?: unknown,
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
    for (const route of ['logout', 'logout-all']) {
      for (const origin of [
        'null',
        'https://unapproved.example',
        'malformed',
      ]) {
        const response = await post(route, { Origin: origin });
        assert.equal(response.status, 403);
        assert.equal(response.headers.get('set-cookie'), null);
      }
      assert.equal(
        (await fetch(`${base}/api/v1/auth/${route}`, { method: 'POST' }))
          .status,
        403,
      );
      const preflight = await fetch(`${base}/api/v1/auth/${route}`, {
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
    }
    assert.equal(calls, 0);
    for (const cookie of [
      '',
      'dl_refresh=bad',
      'dl_refresh=one; dl_refresh=two',
    ]) {
      const response = await post('logout', { Cookie: cookie });
      assert.equal(response.status, 200);
      assert(response.headers.get('set-cookie')!.includes('Max-Age=0'));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const data = z
        .object({
          data: z.null(),
          message: z.string(),
          meta: z.object({ requestId: z.string() }),
        })
        .parse(await response.json());
      assert.equal(data.data, null);
      assert.equal(data.message, 'Logged out');
      assert.equal(typeof data.meta.requestId, 'string');
    }
    assert.equal(calls, 0);
    const response = await post('logout', { Cookie: `dl_refresh=${token}` });
    assert.equal(response.status, 200);
    const cookie = response.headers.get('set-cookie')!;
    for (const attribute of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'])
      assert(cookie.includes(attribute));
    assert(!cookie.includes('Domain='));
    assert(!cookie.includes('Secure'));
    assert(!(await response.text()).includes(token));
    assert.equal((await post('logout-all')).status, 401);
    assert.equal(
      (await post('logout-all', { Authorization: 'Bearer invalid' })).status,
      401,
    );
    const expired = await createAccessTokens(
      env,
      () => new Date(Date.now() - 1000000),
    ).sign({ sub: id, sid: 'b'.repeat(24), role: 'STUDENT', plan: 'FREE' });
    assert.equal(
      (await post('logout-all', { Authorization: `Bearer ${expired}` })).status,
      401,
    );
    assert.equal(
      (
        await post(
          'logout-all',
          { Authorization: `Bearer ${jwt}` },
          { userId: 'c'.repeat(24) },
        )
      ).status,
      400,
    );
    assert.equal((await post('logout?userId=anything')).status, 400);
    const all = await post(
      'logout-all',
      { Authorization: `Bearer ${jwt}` },
      {},
    );
    assert.equal(all.status, 200);
    assert.deepEqual(
      z
        .object({ data: z.object({ revokedSessions: z.number() }) })
        .parse(await all.json()).data,
      { revokedSessions: 2 },
    );
    assert(all.headers.get('set-cookie')!.includes('Max-Age=0'));
    failure = true;
    for (const route of ['logout', 'logout-all']) {
      const failed = await post(route, {
        Cookie: `dl_refresh=${token}`,
        Authorization: `Bearer ${jwt}`,
      });
      assert.equal(failed.status, 503);
      assert.equal(failed.headers.get('set-cookie'), null);
      const text = await failed.text();
      assert(text.includes('DEPENDENCY_UNAVAILABLE'));
      assert(!text.includes(token));
      assert(!text.includes(jwt));
    }
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

test('hosted logout clearing preserves __Host cookie restrictions', async () => {
  const app = express();
  app.post('/', (_req, res) => {
    clearRefreshCookie(res, true);
    res.end();
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}`, {
      method: 'POST',
    });
    const cookie = response.headers.get('set-cookie')!;
    assert(cookie.startsWith('__Host-dl_refresh='));
    for (const attribute of [
      'Secure',
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
    ])
      assert(cookie.includes(attribute));
    assert(!cookie.includes('Domain='));
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
