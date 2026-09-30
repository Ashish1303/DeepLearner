import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { z } from 'zod';
import { AppError } from '../src/common/errors/app-error.js';
import type { RegistrationService } from '../src/modules/auth/registration.service.js';

process.env.ACCESS_TOKEN_SECRET = Buffer.from(
  Array.from({ length: 32 }, (_, i) => i + 1),
).toString('base64');
process.env.ACCESS_TOKEN_ISSUER = 'test-api';
process.env.ACCESS_TOKEN_AUDIENCE = 'test-client';
process.env.APP_ENV = 'LOCAL';
process.env.EMAIL_PROVIDER = 'disabled';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017';
process.env.MONGODB_DB_NAME = 'deeplearner-test';
process.env.LOG_LEVEL = 'silent';
const { createApp } = await import('../src/app.js');
const { mongoose } = await import('../src/config/database.js');
const envelope = z.object({
  data: z
    .object({
      verificationEmailStatus: z.string().optional(),
      verified: z.boolean().optional(),
    })
    .passthrough()
    .nullable()
    .optional(),
  meta: z.object({ requestId: z.string() }),
  message: z.string().nullable().optional(),
  error: z.object({ code: z.string() }).optional(),
});
const read = async (response: Response) =>
  envelope.parse(await response.json());

test('F007 HTTP contracts, strict inputs and unchanged health use no database or provider', async () => {
  let calls = 0;
  let mode = 'accepted';
  const service: RegistrationService = {
    async register(input) {
      calls++;
      assert.equal(input.email, 'student@example.com');
      if (mode === 'duplicate')
        throw new AppError(
          409,
          'AUTH_EMAIL_ALREADY_EXISTS',
          'An account with this email already exists',
        );
      return {
        userId: 'synthetic-user',
        email: input.email,
        status: 'PENDING_VERIFICATION',
        verificationRequired: true,
        verificationEmailStatus:
          mode === 'accepted' ? 'ACCEPTED' : 'NOT_CONFIRMED',
      };
    },
    async verify() {
      if (mode === 'invalid')
        throw new AppError(
          400,
          'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED',
          'Verification token is invalid or expired',
        );
      return { verified: true };
    },
    async resend() {},
  };
  const limits = {
    AUTH_REGISTER_LIMIT: 100,
    AUTH_REGISTER_WINDOW_MS: 60000,
    AUTH_VERIFY_LIMIT: 100,
    AUTH_VERIFY_WINDOW_MS: 60000,
    AUTH_RESEND_LIMIT: 100,
    AUTH_RESEND_WINDOW_MS: 60000,
  };
  const server = createApp(service, limits).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (route: string, body: unknown) =>
    fetch(`${base}/api/v1/auth/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': 'f007-http-test',
      },
      body: JSON.stringify(body),
    });
  const input = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: ' Student@Example.com ',
    password: 'synthetic-password',
  };
  try {
    for (const patch of [
      { role: 'ADMIN' },
      { status: 'ACTIVE' },
      { profile: { learningGoals: [null] } },
      { password: 'short' },
    ])
      assert.equal(
        (await post('register', { ...input, ...patch })).status,
        400,
      );
    assert.equal(calls, 0);
    let response = await post('register', input);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    let body = await read(response);
    assert.equal(body.data?.verificationEmailStatus, 'ACCEPTED');
    assert.equal(body.meta.requestId, 'f007-http-test');
    assert(!JSON.stringify(body).includes('synthetic-password'));
    mode = 'failed';
    response = await post('register', input);
    body = await read(response);
    assert.equal(response.status, 201);
    assert.equal(body.data?.verificationEmailStatus, 'NOT_CONFIRMED');
    assert.match(body.message ?? '', /could not be confirmed/);
    mode = 'duplicate';
    response = await post('register', input);
    assert.equal(response.status, 409);
    assert.equal(
      (await read(response)).error?.code,
      'AUTH_EMAIL_ALREADY_EXISTS',
    );
    mode = 'accepted';
    response = await post('verify-email', { token: 'a'.repeat(43) });
    assert.equal(response.status, 200);
    assert.equal((await read(response)).data?.verified, true);
    mode = 'invalid';
    response = await post('verify-email', { token: 'a'.repeat(43) });
    assert.equal(response.status, 400);
    assert.equal(
      (await read(response)).error?.code,
      'AUTH_VERIFICATION_TOKEN_INVALID_OR_EXPIRED',
    );
    const resendBodies = [];
    for (const email of [
      'pending@example.com',
      'unknown@example.com',
      'active@example.com',
    ]) {
      response = await post('resend-verification', { email });
      assert.equal(response.status, 202);
      resendBodies.push(await response.json());
    }
    assert.deepEqual(resendBodies[0], resendBodies[1]);
    assert.deepEqual(resendBodies[1], resendBodies[2]);
    assert.equal((await fetch(`${base}/api/v1/health`)).status, 200);
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
