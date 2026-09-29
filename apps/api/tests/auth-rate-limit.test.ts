import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { z } from 'zod';
import { createAuthRateLimits } from '../src/modules/auth/auth-rate-limit.js';
import { AppError } from '../src/common/errors/app-error.js';

test('limits normalize email, group IPv6 and prevent email/IP rotation bypasses', async () => {
  const app = express();
  app.use(express.json());
  // Explicit test-only source IP injection; production never trusts this header.
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', {
      value: req.get('X-Test-IP') ?? '192.0.2.1',
    });
    next();
  });
  const limits = createAuthRateLimits({
    AUTH_REGISTER_LIMIT: 2,
    AUTH_REGISTER_WINDOW_MS: 60000,
    AUTH_VERIFY_LIMIT: 2,
    AUTH_VERIFY_WINDOW_MS: 60000,
    AUTH_RESEND_LIMIT: 2,
    AUTH_RESEND_WINDOW_MS: 60000,
  });
  app.post('/register', limits.register, (_req, res) => res.sendStatus(200));
  app.post('/verify', limits.verify, (_req, res) => res.sendStatus(200));
  app.post('/resend', ...limits.resend, (_req, res) => res.sendStatus(202));
  const handler: express.ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
  ) => {
    void _next; // Express identifies error middleware by its four arguments.
    assert(error instanceof AppError);
    res.status(error.statusCode).json({ code: error.code });
  };
  app.use(handler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const post = (path: string, ip: string, email = 'student@example.com') =>
    fetch(`http://127.0.0.1:${address.port}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Test-IP': ip },
      body: JSON.stringify({ email }),
    });
  try {
    assert.equal(
      (await post('resend', '192.0.2.1', ' STUDENT@EXAMPLE.COM ')).status,
      202,
    );
    assert.equal((await post('resend', '192.0.2.2')).status, 202);
    const blocked = await post('resend', '192.0.2.3');
    assert.equal(blocked.status, 429);
    assert.equal(
      z.object({ code: z.string() }).parse(await blocked.json()).code,
      'RATE_LIMIT_EXCEEDED',
    );
    assert.equal(
      (await post('resend', '192.0.2.4', 'one@example.com')).status,
      202,
    );
    assert.equal(
      (await post('resend', '192.0.2.4', 'two@example.com')).status,
      202,
    );
    assert.equal(
      (await post('resend', '192.0.2.4', 'three@example.com')).status,
      429,
    );
    for (const path of ['register', 'verify']) {
      assert.equal((await post(path, '2001:db8:1::1')).status, 200);
      assert.equal((await post(path, '2001:db8:1::2')).status, 200);
      assert.equal((await post(path, '2001:db8:1::3')).status, 429);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
