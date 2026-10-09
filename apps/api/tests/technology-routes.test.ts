import type {
  ApiSuccess,
  ApiError,
  PaginationMeta,
} from '@deeplearner/shared-types';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TechnologyService } from '../src/modules/technologies/technology.service.js';
import { AppError } from '../src/common/errors/app-error.js';
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
function app(service: TechnologyService, max = 120) {
  return createApp(
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    service,
    { max, windowMs: 900000 },
  );
}
test('public catalog HTTP validates queries, preserves envelopes/CORS and requires no JWT/cookie', async () => {
  let calls = 0;
  let fail = false;
  const service: TechnologyService = {
    async list(query) {
      calls++;
      if (fail)
        throw new AppError(
          503,
          'DEPENDENCY_UNAVAILABLE',
          'Catalog unavailable',
        );
      return { items: [], pagination: { ...query, total: 0, totalPages: 0 } };
    },
  };
  const server = app(service).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/technologies`;
  try {
    const res = await fetch(url);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('set-cookie'), null);
    const body = (await res.json()) as ApiSuccess<unknown[], PaginationMeta>;
    assert.deepEqual(body.data, []);
    assert.equal(body.meta.requestId, res.headers.get('x-request-id'));
    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 20);
    assert.equal(body.meta.totalPages, 0);
    const valid = await fetch(url + '?page=2&limit=100', {
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('access-control-allow-credentials'), null);
    assert.equal(
      valid.headers.get('access-control-allow-origin'),
      'http://127.0.0.1:3000',
    );
    const before = calls;
    for (const query of [
      '?status=DRAFT',
      '?page=1&page=2',
      '?page[x]=1',
      '?limit=101',
      '?page=0',
      '?sortBy=name',
      '?$where=PRIVATE_SENTINEL',
    ]) {
      const invalid = await fetch(url + query);
      assert.equal(invalid.status, 400);
      const text = await invalid.text();
      assert(text.includes('VALIDATION_ERROR'));
      assert(!text.includes('PRIVATE_SENTINEL'));
    }
    assert.equal(calls, before);
    assert.equal(
      (await fetch(url, { headers: { Origin: 'https://unapproved.example' } }))
        .status,
      403,
    );
    assert.equal((await fetch(url, { method: 'POST' })).status, 404);
    assert.equal((await fetch(url + '/javascript')).status, 404);
    fail = true;
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.equal(
      ((await unavailable.json()) as ApiError).error.code,
      'DEPENDENCY_UNAVAILABLE',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
test('catalog IP limiter returns standardized 429 without invoking the service again', async () => {
  let calls = 0;
  const server = app(
    {
      async list(query) {
        calls++;
        return { items: [], pagination: { ...query, total: 0, totalPages: 0 } };
      },
    },
    1,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/technologies`;
  try {
    assert.equal((await fetch(url)).status, 200);
    const limited = await fetch(url);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('cache-control'), 'no-store');
    assert.equal(
      ((await limited.json()) as ApiError).error.code,
      'RATE_LIMIT_EXCEEDED',
    );
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
