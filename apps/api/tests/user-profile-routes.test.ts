import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { UserService } from '../src/modules/users/user.service.js';
import { AppError } from '../src/common/errors/app-error.js';
Object.assign(process.env, {
  APP_ENV: 'LOCAL',
  EMAIL_PROVIDER: 'disabled',
  LOG_LEVEL: 'silent',
  GOOGLE_CLIENT_ID: '',
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
const { createAccessTokens } =
  await import('../src/modules/auth/access-token.service.js');
const { mongoose } = await import('../src/config/database.js');
test('profile HTTP authenticates JWT subject, enforces Origin, rejects injection and returns no cookies', async () => {
  const sub = 'a'.repeat(24);
  let calls = 0;
  let fail = false;
  const dto = {
    id: sub,
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    emailVerified: true,
    role: 'STUDENT' as const,
    plan: 'FREE' as const,
    status: 'ACTIVE' as const,
    authMethods: ['GOOGLE' as const],
    profile: null,
    createdAt: new Date().toISOString(),
  };
  const service: UserService = {
    async get(id) {
      assert.equal(id, sub);
      calls++;
      if (fail)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
      return dto;
    },
    async patch(id, input) {
      assert.equal(id, sub);
      assert.deepEqual(input, { firstName: 'New' });
      calls++;
      return { ...dto, firstName: 'New' };
    },
  };
  const server = createApp(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/users/me`;
  const token = await createAccessTokens(env).sign({
    sub,
    sid: 'b'.repeat(24),
    role: 'ADMIN',
    plan: 'PREMIUM',
  });
  const send = (
    method: string,
    body?: unknown,
    origin?: string,
    bearer: string | null = token,
  ) =>
    fetch(url, {
      method,
      headers: {
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(origin ? { Origin: origin } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await send('GET', undefined, undefined, null)).status, 401);
    assert.equal((await send('GET', undefined, undefined, 'bad')).status, 401);
    for (const origin of [
      undefined,
      'null',
      'https://evil.example',
      'malformed',
    ])
      assert.equal(
        (await send('PATCH', { firstName: 'New' }, origin)).status,
        403,
      );
    assert.equal(calls, 0);
    for (const body of [
      {},
      { profile: {} },
      { firstName: null },
      { role: 'ADMIN' },
      { id: 'c'.repeat(24) },
      { 'profile.learningGoals': [] },
      { $set: { firstName: 'New' } },
    ])
      assert.equal(
        (await send('PATCH', body, 'http://127.0.0.1:3000')).status,
        400,
      );
    const response = await send('GET');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.notEqual(
      response.headers.get('access-control-allow-credentials'),
      'true',
    );
    assert(response.headers.get('x-request-id'));
    assert.deepEqual(
      ((await response.json()) as { data: typeof dto }).data,
      dto,
    );
    const updated = await send(
      'PATCH',
      { firstName: ' New ' },
      'http://127.0.0.1:3000',
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.headers.get('set-cookie'), null);
    assert.equal(
      ((await updated.json()) as { data: typeof dto }).data.firstName,
      'New',
    );
    assert.equal(
      (
        await fetch(url + '?userId=other', {
          headers: { Authorization: `Bearer ${token}` },
        })
      ).status,
      400,
    );
    fail = true;
    const unavailable = await send('GET');
    assert.equal(unavailable.status, 503);
    assert.equal(
      ((await unavailable.json()) as { error: { code: string } }).error.code,
      'DEPENDENCY_UNAVAILABLE',
    );
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
