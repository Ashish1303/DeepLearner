import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import express from 'express';
import { authOrigin } from '../src/middleware/auth-origin.js';
import {
  readRefreshCookie,
  setRefreshCookie,
  clearRefreshCookie,
} from '../src/modules/auth/refresh-cookie.js';
import { AppError } from '../src/common/errors/app-error.js';
test('cookie parsing, exact Origin, loopback restriction and fixed cookie expiry over HTTP', async () => {
  const app = express();
  const config = {
    APP_ENV: 'LOCAL',
    AUTH_COOKIE_SECURE: false,
    CORS_ORIGINS: [
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'https://example.com',
    ],
  };
  app.get('/local', authOrigin(config), (_req, res) => {
    setRefreshCookie(
      res,
      false,
      'synthetic',
      new Date('2026-10-01'),
      new Date('2026-09-30'),
    );
    res.end();
  });
  app.get('/hosted', (_req, res) => {
    setRefreshCookie(
      res,
      true,
      'synthetic',
      new Date('2026-10-01'),
      new Date('2026-09-30'),
    );
    res.end();
  });
  app.get('/clear', (_req, res) => {
    clearRefreshCookie(res, true);
    res.end();
  });
  app.get('/read', (req, res) => res.send(readRefreshCookie(req, true)));
  app.use(((error: AppError, _req, res, next) => {
    void next;
    res.status(error.statusCode).json({ code: error.code });
  }) satisfies express.ErrorRequestHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const headers of [
      {},
      { Origin: 'null' },
      { Origin: 'http://localhost:3000' },
      { Origin: 'https://example.com' },
    ])
      assert.equal((await fetch(`${base}/local`, { headers })).status, 403);
    const local = await fetch(`${base}/local`, {
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    assert.equal(local.status, 200);
    assert(!local.headers.get('set-cookie')!.includes('Secure'));
    config.APP_ENV = 'PRODUCTION';
    assert.equal(
      (
        await fetch(`${base}/local`, {
          headers: { Origin: 'http://127.0.0.1:3000' },
        })
      ).status,
      403,
    );
    const cookie = (await fetch(`${base}/hosted`)).headers.get('set-cookie')!;
    for (const part of [
      '__Host-dl_refresh=',
      'Secure',
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=86400',
    ])
      assert(cookie.includes(part));
    assert(!cookie.includes('Domain='));
    assert(
      (await fetch(`${base}/clear`)).headers
        .get('set-cookie')!
        .includes('Max-Age=0'),
    );
    assert.equal((await fetch(`${base}/read`)).status, 401);
    assert.equal(
      (
        await fetch(`${base}/read`, {
          headers: { Cookie: '__Host-dl_refresh=a; __Host-dl_refresh=b' },
        })
      ).status,
      401,
    );
    assert.equal(
      await (
        await fetch(`${base}/read`, {
          headers: { Cookie: '__Host-dl_refresh=synthetic' },
        })
      ).text(),
      'synthetic',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
