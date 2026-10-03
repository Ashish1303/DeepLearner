import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { createRecoveryRateLimits } from '../src/modules/auth/password-recovery-rate-limit.js';
import { AppError } from '../src/common/errors/app-error.js';
test('F010 independent budgets normalize email, group IPv6 and limit reset/change without raw keys', async () => {
  const app = express();
  app.use(express.json());
  // Synthetic IP injection is test-only; production does not trust these headers.
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', {
      value: req.headers['x-test-ip'] ?? '127.0.0.1',
    });
    req.auth = {
      sub: String(req.headers['x-test-user'] ?? 'user'),
      sid: 'session',
      role: 'STUDENT',
      plan: 'FREE',
    };
    next();
  });
  const limits = createRecoveryRateLimits({
    AUTH_FORGOT_LIMIT: 2,
    AUTH_FORGOT_WINDOW_MS: 60000,
    AUTH_RESET_LIMIT: 2,
    AUTH_RESET_WINDOW_MS: 60000,
    AUTH_CHANGE_LIMIT: 2,
    AUTH_CHANGE_WINDOW_MS: 60000,
    AUTH_CHANGE_IP_LIMIT: 3,
    AUTH_CHANGE_IP_WINDOW_MS: 60000,
  });
  app.post('/forgot', ...limits.forgot, (_req, res) => res.sendStatus(202));
  app.post('/reset', limits.reset, (_req, res) => res.sendStatus(200));
  app.post('/change', limits.changeIp, limits.changeUser, (_req, res) =>
    res.sendStatus(200),
  );
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const post = (route: string, email: string, ip: string, user = 'u') =>
    fetch(`http://127.0.0.1:${addr.port}/${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-ip': ip,
        'x-test-user': user,
      },
      body: JSON.stringify({ email }),
    });
  try {
    assert.equal(
      (await post('forgot', 'a@example.com', '192.0.2.1')).status,
      202,
    );
    assert.equal(
      (await post('forgot', ' A@EXAMPLE.COM ', '192.0.2.2')).status,
      202,
    );
    assert.equal(
      (await post('forgot', 'a@example.com', '192.0.2.3')).status,
      429,
    );
    assert.equal(
      (await post('forgot', 'b@example.com', '192.0.2.1')).status,
      202,
    );
    assert.equal(
      (await post('forgot', 'c@example.com', '192.0.2.1')).status,
      429,
    );
    assert.equal(
      (await post('reset', '', '2001:db8:abcd:1200::1')).status,
      200,
    );
    assert.equal(
      (await post('reset', '', '2001:db8:abcd:1201::2')).status,
      200,
    );
    const blocked = await post('reset', '', '2001:db8:abcd:1202::3');
    assert.equal(blocked.status, 429);
    assert(!(await blocked.text()).includes('2001:'));
    assert.equal((await post('change', '', '192.0.2.4')).status, 200);
    assert.equal((await post('change', '', '192.0.2.5')).status, 200);
    assert.equal((await post('change', '', '192.0.2.6')).status, 429);
    assert.equal((await post('change', '', '192.0.2.4', 'v')).status, 200);
    assert.equal((await post('change', '', '192.0.2.4', 'w')).status, 200);
    assert.equal((await post('change', '', '192.0.2.4', 'x')).status, 429);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
