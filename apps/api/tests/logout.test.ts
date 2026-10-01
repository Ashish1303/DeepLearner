import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/common/errors/app-error.js';
import { createLogoutService } from '../src/modules/auth/logout.service.js';
import { issueRefreshSecret } from '../src/modules/auth/refresh-token.service.js';

test('logout skips malformed tokens and passes only the digest, session ID and request ID', async () => {
  let calls = 0;
  const token = issueRefreshSecret();
  const id = 'a'.repeat(24);
  const clock = new Date();
  const service = createLogoutService(
    {
      async logout(input, now) {
        calls++;
        assert.deepEqual(input, {
          sessionId: id,
          hash: token.hash,
          requestId: 'request',
        });
        assert.equal(now(), clock);
        assert(!JSON.stringify(input).includes(token.secret));
      },
      async logoutAll(input, now) {
        assert.deepEqual(input, { userId: id, requestId: 'all' });
        assert.equal(now(), clock);
        return 3;
      },
    },
    () => clock,
  );
  for (const value of [
    undefined,
    '',
    'malformed',
    `${id}.short`,
    `${id}.${'!'.repeat(43)}`,
  ])
    await service.logout(value, 'request');
  assert.equal(calls, 0);
  await service.logout(`${id}.${token.secret}`, 'request');
  assert.equal(calls, 1);
  assert.equal(await service.logoutAll(id, 'all'), 3);
});

test('logout never swallows repository failures as idempotent success', async () => {
  const failure = new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Unavailable');
  const service = createLogoutService({
    async logout() {
      throw failure;
    },
    async logoutAll() {
      throw failure;
    },
  });
  await assert.rejects(
    service.logout(
      `${'a'.repeat(24)}.${issueRefreshSecret().secret}`,
      'request',
    ),
    (error) => error === failure,
  );
  await assert.rejects(
    service.logoutAll('a'.repeat(24), 'request'),
    (error) => error === failure,
  );
});
