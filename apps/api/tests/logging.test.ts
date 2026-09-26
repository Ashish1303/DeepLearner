import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('structured logs correlate requests and exclude secrets, raw paths and errors', () => {
  // A separate process captures real Pino output without monkeypatching globals.
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `
    import { once } from 'node:events';
    import express from 'express';
    import { app } from './src/app.ts';
    import { logger } from './src/common/logging/logger.ts';
    import { requestId } from './src/middleware/request-id.ts';
    import { requestLogger, routeLabel } from './src/middleware/request-logger.ts';
    import { errorHandler } from './src/middleware/error-handler.ts';
    const fixture = express();
    fixture.use(requestId, requestLogger);
    fixture.get('/fail', routeLabel('/test/fail'), async () => { throw new Error('SECRET_SENTINEL'); });
    fixture.use(errorHandler);
    for (const [target, path, id] of [
      [app, '/api/v1/health?token=SECRET_SENTINEL', 'health-check'],
      [app, '/SECRET_SENTINEL?password=SECRET_SENTINEL', 'missing-check'],
      [fixture, '/fail', 'failure-check']
    ]) {
      const server = target.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const res = await fetch('http://127.0.0.1:' + server.address().port + path, { headers: { 'X-Request-Id': id, Authorization: 'Bearer SECRET_SENTINEL', Cookie: 'secret=SECRET_SENTINEL' } });
      await res.text();
      await new Promise(resolve => server.close(resolve));
    }
    logger.info({ password: 'SECRET_SENTINEL', passwordHash: 'SECRET_SENTINEL', accessToken: 'SECRET_SENTINEL', refreshToken: 'SECRET_SENTINEL', headers: { authorization: 'SECRET_SENTINEL' }, body: { password: 'SECRET_SENTINEL' }, req: { url: 'SECRET_SENTINEL' }, err: new Error('SECRET_SENTINEL'), context: { apiKey: 'SECRET_SENTINEL', cookie: 'SECRET_SENTINEL', tokenHash: 'SECRET_SENTINEL' } }, 'Redaction probe');
  `,
    ],
    {
      cwd: new URL('..', import.meta.url),
      env: {
        ...process.env,
        APP_ENV: 'LOCAL',
        CORS_ORIGINS: 'http://localhost:3000,http://localhost:5173',
        LOG_LEVEL: 'info',
      },
      encoding: 'utf8',
      timeout: 20000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert(!result.stdout.includes('SECRET_SENTINEL'));
  assert(!result.stderr.includes('SECRET_SENTINEL'));
  const logs = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const completed = logs.filter((line) => line.msg === 'Request completed');
  assert.equal(completed.length, 3);
  assert.deepEqual(
    completed.map((line) => [line.requestId, line.route, line.status]),
    [
      ['health-check', '/api/v1/health', 200],
      ['missing-check', 'unmatched', 404],
      ['failure-check', '/test/fail', 500],
    ],
  );
  for (const line of completed) {
    assert.equal(line.method, 'GET');
    assert.equal(line.service, 'deeplearner-api');
    assert.equal(typeof line.time, 'number');
    assert.equal(typeof line.level, 'number');
    assert(line.durationMs >= 0);
  }
  const failures = logs.filter((line) => line.msg === 'Request failed');
  assert.equal(failures.length, 1);
  assert.equal(failures[0].requestId, 'failure-check');
  assert.equal(failures[0].errorCode, 'INTERNAL_ERROR');
});
