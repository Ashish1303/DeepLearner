import type {
  ApiSuccess,
  ApiError,
  PaginationMeta,
} from '@deeplearner/shared-types';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import type { LearningPathService } from '../src/modules/learning-paths/learning-path.service.js';
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
function app(service: LearningPathService, max = 120) {
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
    undefined,
    undefined,
    service,
    { max, windowMs: 900000 },
  );
}
const id = '000000000000000000000017';
const dto = {
  id,
  technologyId: id,
  title: 'Synthetic path',
  slug: 'synthetic',
  description: null,
  targetLevel: null,
  completionScore: 70,
  order: 0,
};
test('public learning path HTTP validates input, preserves cookies/auth boundaries and envelopes', async () => {
  let calls = 0;
  let failure: AppError | undefined;
  const service: LearningPathService = {
    async list(query) {
      calls++;
      if (failure) throw failure;
      return {
        items: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total: 0,
          totalPages: 0,
        },
      };
    },
    async detail() {
      calls++;
      if (failure) throw failure;
      return dto;
    },
  };
  const server = app(service).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/learning-paths`;
  try {
    for (const headers of [
      {},
      {
        Cookie: 'synthetic=present',
        Authorization: 'Bearer invalid-synthetic',
      },
    ]) {
      const res = await fetch(`${url}?technologyId=${id}`, { headers });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(res.headers.get('set-cookie'), null);
      const body = (await res.json()) as ApiSuccess<unknown[], PaginationMeta>;
      assert.deepEqual(body.data, []);
      assert.deepEqual(body.meta, {
        requestId: res.headers.get('x-request-id'),
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
      const detail = await fetch(`${url}/${id}`, { headers });
      assert.equal(detail.status, 200);
      assert.equal(detail.headers.get('set-cookie'), null);
      assert.deepEqual(
        ((await detail.json()) as ApiSuccess<typeof dto>).data,
        dto,
      );
    }
    const valid = await fetch(`${url}?technologyId=${id}&page=2&limit=100`, {
      headers: { Origin: 'http://127.0.0.1:3000' },
    });
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('access-control-allow-credentials'), null);
    assert.equal(
      valid.headers.get('access-control-allow-origin'),
      'http://127.0.0.1:3000',
    );
    const before = calls;
    for (const suffix of [
      '',
      '?technologyId=bad',
      `?technologyId=${id}&technologyId=${id}`,
      `?technologyId[x]=${id}`,
      `?technologyId=${id}&page=1&page=2`,
      `?technologyId=${id}&page[x]=1`,
      `?technologyId=${id}&limit=101`,
      `?technologyId=${id}&status=DRAFT`,
      `?technologyId=${id}&$where=PRIVATE_SENTINEL`,
      '/bad',
      `/${id}?page=1`,
    ]) {
      const res = await fetch(url + suffix);
      assert.equal(res.status, 400);
      const text = await res.text();
      assert(text.includes('VALIDATION_ERROR'));
      assert(!text.includes('PRIVATE_SENTINEL'));
    }
    assert.equal(calls, before);
    assert.equal(
      (
        await fetch(`${url}/${id}`, {
          headers: { Origin: 'https://unapproved.example' },
        })
      ).status,
      403,
    );
    for (const method of ['POST', 'PATCH', 'DELETE'])
      assert.equal((await fetch(url, { method })).status, 404);
    assert.equal(calls, before);
    for (const [suffix, code] of [
      [`?technologyId=${id}`, 'TECHNOLOGY_NOT_FOUND'],
      [`/${id}`, 'LEARNING_PATH_NOT_FOUND'],
    ]) {
      failure = new AppError(404, code!, 'Resource not found');
      const res = await fetch(url + suffix);
      assert.equal(res.status, 404);
      assert.equal(((await res.json()) as ApiError).error.code, code);
    }
    failure = new AppError(
      503,
      'DEPENDENCY_UNAVAILABLE',
      'Learning paths unavailable',
    );
    for (const suffix of [`?technologyId=${id}`, `/${id}`]) {
      const res = await fetch(url + suffix);
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(
        ((await res.json()) as ApiError).error.code,
        'DEPENDENCY_UNAVAILABLE',
      );
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
test('learning path list and detail share one IP budget', async () => {
  let calls = 0;
  const server = app(
    {
      async list(query) {
        calls++;
        return {
          items: [],
          pagination: {
            page: query.page,
            limit: query.limit,
            total: 0,
            totalPages: 0,
          },
        };
      },
      async detail() {
        calls++;
        return dto;
      },
    },
    1,
  ).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/v1/learning-paths`;
  try {
    assert.equal((await fetch(`${url}?technologyId=${id}`)).status, 200);
    const res = await fetch(`${url}/${id}`);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(
      ((await res.json()) as ApiError).error.code,
      'RATE_LIMIT_EXCEEDED',
    );
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
