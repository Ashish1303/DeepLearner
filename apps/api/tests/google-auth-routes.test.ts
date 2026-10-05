import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import type { GoogleAuthService } from '../src/modules/auth/google-auth.service.js';
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
const { mongoose } = await import('../src/config/database.js');
test('Google HTTP uses strict Origin, safe envelopes, 200/201 and commit-only cookies', async () => {
  let created = true,
    fail = false,
    calls = 0;
  const service: GoogleAuthService = {
    async login(credential) {
      calls++;
      assert.equal(credential, 'synthetic-google-credential');
      if (fail)
        throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
      return {
        created,
        accessToken: 'synthetic-access',
        expiresInSeconds: 900,
        refreshToken: 'private-refresh-secret',
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'a'.repeat(24),
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'STUDENT',
          plan: 'FREE',
          status: 'ACTIVE',
        },
      };
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
    service,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/auth/google`;
  const post = (
    body: unknown,
    origin: string | undefined = 'http://127.0.0.1:3000',
  ) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    for (const origin of ['null', 'https://evil.example', 'malformed', ''])
      assert.equal((await post({}, origin)).status, 403);
    assert.equal(calls, 0);
    for (const body of [
      {},
      { credential: 1 },
      { credential: 'x', role: 'ADMIN' },
      { credential: 'x'.repeat(16385) },
    ])
      assert.equal((await post(body)).status, 400);
    for (const isNew of [true, false]) {
      created = isNew;
      const response = await post({
        credential: 'synthetic-google-credential',
      });
      assert.equal(response.status, created ? 201 : 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(
        response.headers.get('access-control-allow-credentials'),
        'true',
      );
      assert(response.headers.get('set-cookie')?.includes('HttpOnly'));
      assert(response.headers.get('x-request-id'));
      const text = await response.text();
      assert(text.includes('synthetic-access'));
      assert(!text.includes('private-refresh-secret'));
      assert(!text.includes('synthetic-google-credential'));
      assert(!text.includes('created'));
    }
    fail = true;
    const response = await post({ credential: 'synthetic-google-credential' });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert((await response.text()).includes('DEPENDENCY_UNAVAILABLE'));
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
