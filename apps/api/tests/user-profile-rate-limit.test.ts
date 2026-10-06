import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createUserRateLimits } from '../src/modules/users/user-rate-limit.js';
import type { AppError } from '../src/common/errors/app-error.js';
test('profile budgets separate GET/PATCH users and share an IPv6-grouped IP ceiling', async () => {
  const app = express();
  const limits = createUserRateLimits({
    get: 2,
    patch: 1,
    ip: 5,
    windowMs: 60000,
  });
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { value: req.headers['x-test-ip'] });
    req.auth = {
      sub: String(req.headers['x-test-user']),
      sid: 'a'.repeat(24),
      role: 'STUDENT',
      plan: 'FREE',
    };
    next();
  });
  app.get('/', limits.ip, limits.get, (_req, res) => res.sendStatus(200));
  app.patch('/', limits.ip, limits.patch, (_req, res) => res.sendStatus(200));
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const request = (
    method: string,
    user = 'user-one',
    ip = '2001:db8:abcd:1200::1',
  ) =>
    fetch(`http://127.0.0.1:${address.port}/`, {
      method,
      headers: { 'x-test-user': user, 'x-test-ip': ip },
    });
  try {
    assert.equal((await request('GET')).status, 200);
    assert.equal((await request('GET')).status, 200);
    const blocked = await request('GET', 'user-one', '192.0.2.1');
    assert.equal(blocked.status, 429);
    assert(!(await blocked.text()).includes('user-one'));
    assert.equal((await request('PATCH')).status, 200);
    assert.equal((await request('PATCH')).status, 429);
    assert.equal(
      (await request('GET', 'user-two', '2001:db8:abcd:1201::2')).status,
      200,
    );
    assert.equal(
      (await request('GET', 'user-three', '2001:db8:abcd:1202::3')).status,
      429,
    );
    assert.equal((await request('GET', 'user-three', '192.0.2.2')).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
