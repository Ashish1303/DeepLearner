import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createGoogleRateLimit } from '../src/modules/auth/google-auth-rate-limit.js';
import { AppError } from '../src/common/errors/app-error.js';
test('Google IP budgets group IPv6 and do not expose IP or credential values', async () => {
  const app = express();
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { value: req.headers['x-test-ip'] });
    next();
  });
  app.post(
    '/',
    createGoogleRateLimit({
      AUTH_GOOGLE_LIMIT: 2,
      AUTH_GOOGLE_WINDOW_MS: 60000,
    }),
    (_req, res) => res.sendStatus(200),
  );
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const post = (ip: string) =>
    fetch(`http://127.0.0.1:${address.port}/`, {
      method: 'POST',
      headers: { 'x-test-ip': ip },
      body: 'PRIVATE_CREDENTIAL',
    });
  try {
    assert.equal((await post('2001:db8:abcd:1200::1')).status, 200);
    assert.equal((await post('2001:db8:abcd:1201::2')).status, 200);
    const blocked = await post('2001:db8:abcd:1202::3');
    assert.equal(blocked.status, 429);
    const text = await blocked.text();
    assert(!text.includes('2001:'));
    assert(!text.includes('PRIVATE_CREDENTIAL'));
    assert.equal((await post('192.0.2.1')).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
