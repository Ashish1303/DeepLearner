import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createLoginRateLimits } from '../src/modules/auth/login-rate-limit.js';
import { AppError } from '../src/common/errors/app-error.js';
test('normalized login failure budget, independent IP ceiling and refresh limit', async () => {
  const app = express();
  app.use(express.json());
  const limits = createLoginRateLimits({
    AUTH_LOGIN_LIMIT: 2,
    AUTH_LOGIN_WINDOW_MS: 60000,
    AUTH_LOGIN_IP_LIMIT: 5,
    AUTH_LOGIN_IP_WINDOW_MS: 60000,
    AUTH_REFRESH_LIMIT: 2,
    AUTH_REFRESH_WINDOW_MS: 60000,
  });
  app.post('/login', ...limits.login, (_req, res) => res.sendStatus(401));
  app.post('/refresh', limits.refresh, (_req, res) => res.sendStatus(200));
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (route: string, email = 'a@example.com') =>
    fetch(`${base}/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  try {
    assert.equal((await post('login')).status, 401);
    assert.equal((await post('login', ' A@EXAMPLE.COM ')).status, 401);
    assert.equal((await post('login')).status, 429);
    assert.equal((await post('login', 'b@example.com')).status, 401);
    assert.equal((await post('login', 'c@example.com')).status, 401);
    assert.equal((await post('login', 'd@example.com')).status, 429);
    assert.equal((await post('refresh')).status, 200);
    assert.equal((await post('refresh')).status, 200);
    assert.equal((await post('refresh')).status, 429);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
