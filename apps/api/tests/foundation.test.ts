import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { after, before, test } from 'node:test';
import express from 'express';
import { z } from 'zod';
import { app } from '../src/app.js';
import { AppError } from '../src/common/errors/app-error.js';
import { successResponse } from '../src/common/http/response.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestId } from '../src/middleware/request-id.js';
import { validateRequest } from '../src/middleware/validate.js';

const envelope = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.unknown(),
    message: z.string().nullable(),
    meta: z.object({ requestId: z.string() }),
  }),
  z.object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z
        .array(z.object({ field: z.string(), message: z.string() }))
        .optional(),
    }),
    meta: z.object({ requestId: z.string() }),
  }),
]);
async function failure(response: globalThis.Response) {
  const body = envelope.parse(await response.json());
  assert.equal(body.success, false);
  return body;
}

const fixture = express();
fixture.use(requestId, express.json({ limit: '256kb' }));
const schema = z.object({
  body: z.strictObject({ label: z.string().trim().min(1) }),
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});
fixture.post(
  '/validate/:id',
  validateRequest(schema, (req, res, input) => {
    const count: number = input.query.limit;
    res.json(
      successResponse(
        { ...input, count, originalQuery: req.query },
        req.requestId,
      ),
    );
  }),
);
fixture.get('/known', () => {
  throw new AppError(409, 'TEST_CONFLICT', 'Safe conflict', [
    { field: 'body.label', message: 'Unavailable' },
  ]);
});
fixture.get('/sync', () => {
  throw new Error('SECRET_SENTINEL');
});
fixture.get('/async', async () => {
  await Promise.resolve();
  throw new Error('SECRET_SENTINEL');
});
fixture.get('/arbitrary', () => {
  throw { status: 401, message: 'SECRET_SENTINEL' };
});
fixture.post(
  '/record',
  validateRequest(
    z.object({ body: z.record(z.string(), z.number()) }),
    (_req, res) => {
      res.end();
    },
  ),
);
fixture.post(
  '/custom',
  validateRequest(
    z.object({
      body: z.object({
        value: z.string().refine(async () => false, 'SECRET_SENTINEL'),
      }),
    }),
    (_req, res) => {
      res.end();
    },
  ),
);
fixture.use(errorHandler);

const server = app.listen(0, '127.0.0.1');
const fixtureServer = fixture.listen(0, '127.0.0.1');
let base = '';
let testBase = '';
before(async () => {
  await Promise.all([
    once(server, 'listening'),
    once(fixtureServer, 'listening'),
  ]);
  const address = server.address();
  const fixtureAddress = fixtureServer.address();
  assert(address && typeof address !== 'string');
  assert(fixtureAddress && typeof fixtureAddress !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  testBase = `http://127.0.0.1:${fixtureAddress.port}`;
});
after(async () => {
  await Promise.all(
    [server, fixtureServer].map(
      (entry) =>
        new Promise<void>((resolve, reject) => {
          entry.close((error) => (error ? reject(error) : resolve()));
          entry.closeAllConnections();
        }),
    ),
  );
});

test('health preserves liveness contract, correlation and security headers', async () => {
  const response = await fetch(`${base}/api/v1/health`, {
    headers: { 'X-Request-Id': 'test_123' },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: { status: 'ok', service: 'deeplearner-api' },
    message: null,
    meta: { requestId: 'test_123' },
  });
  assert.equal(response.headers.get('x-request-id'), 'test_123');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-powered-by'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.match(
    response.headers.get('content-security-policy') ?? '',
    /default-src 'self'/,
  );
  assert.match(
    response.headers.get('strict-transport-security') ?? '',
    /max-age=/,
  );
});

test('unknown API and non-API routes have safe 404 envelopes', async () => {
  for (const path of [
    '/api/v1/SECRET_SENTINEL?token=SECRET_SENTINEL',
    '/missing',
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      success: false,
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' },
      meta: { requestId: response.headers.get('x-request-id') },
    });
  }
});

test('request IDs are generated for missing, invalid and oversized headers', async () => {
  for (const id of [undefined, 'bad id', 'x'.repeat(129)]) {
    const response = await fetch(`${base}/api/v1/health`, {
      headers: id === undefined ? {} : { 'X-Request-Id': id },
    });
    const generated = response.headers.get('x-request-id');
    assert.match(generated ?? '', /^[a-f0-9-]{36}$/);
    assert.equal(
      envelope.parse(await response.json()).meta.requestId,
      generated,
    );
  }
});

test('duplicate request ID headers are replaced', async () => {
  const id = await new Promise<string | string[] | undefined>(
    (resolve, reject) => {
      const req = request(
        `${base}/api/v1/health`,
        { headers: { 'X-Request-Id': ['first', 'second'] } },
        (res) => {
          res.resume();
          res.on('end', () => resolve(res.headers['x-request-id']));
        },
      );
      req.on('error', reject);
      req.end();
    },
  );
  assert.equal(typeof id, 'string');
  assert.match(String(id), /^[a-f0-9-]{36}$/);
});

test('CORS allows configured clients without credentials, rejects other origins', async () => {
  for (const origin of ['http://localhost:3000', 'http://localhost:5173']) {
    const response = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: origin },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(
      response.headers.get('access-control-allow-credentials'),
      null,
    );
    assert.match(
      response.headers.get('access-control-expose-headers') ?? '',
      /X-Request-Id/i,
    );
    assert.match(response.headers.get('vary') ?? '', /Origin/);
  }
  for (const origin of [
    'https://evil.example',
    'null',
    'http://localhost:3000.evil.example',
  ]) {
    const response = await fetch(`${base}/api/v1/health`, {
      headers: { Origin: origin },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await failure(response)).error.code, 'ORIGIN_NOT_ALLOWED');
  }
});

test('preflight exposes only an allowed origin; no-origin requests remain usable', async () => {
  const response = await fetch(`${base}/api/v1/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'X-Request-Id',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:3000',
  );
  assert.equal(response.headers.get('access-control-allow-credentials'), null);
  assert.match(
    response.headers.get('access-control-allow-headers') ?? '',
    /X-Request-Id/i,
  );
  const denied = await fetch(`${base}/api/v1/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'GET',
    },
  });
  assert.equal(denied.status, 403);
  const noOrigin = await fetch(`${base}/api/v1/health`);
  assert.equal(noOrigin.status, 200);
  assert.equal(noOrigin.headers.get('access-control-allow-origin'), null);
});

test('parser failures preserve safe errors and request IDs', async () => {
  const cases = [
    {
      body: '{SECRET_SENTINEL',
      headers: { 'Content-Type': 'application/json' },
      status: 400,
      code: 'VALIDATION_ERROR',
    },
    {
      body: JSON.stringify({ text: 'x'.repeat(256 * 1024) }),
      headers: { 'Content-Type': 'application/json' },
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    },
    {
      body: '{}',
      headers: { 'Content-Type': 'application/json; charset=unsupported' },
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
    {
      body: '{}',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'unsupported',
      },
      status: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    },
  ];
  for (const entry of cases) {
    const response = await fetch(`${base}/missing`, {
      method: 'POST',
      headers: entry.headers,
      body: entry.body,
    });
    assert.equal(response.status, entry.status);
    const body = await failure(response);
    assert.equal(body.error.code, entry.code);
    assert.equal(body.meta.requestId, response.headers.get('x-request-id'));
    assert(!JSON.stringify(body).includes('SECRET_SENTINEL'));
  }
  const within = await fetch(`${base}/missing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'x'.repeat(256 * 1024 - 11) }),
  });
  assert.equal(within.status, 404);
});

test('validation transforms all input sources without mutating query', async () => {
  const response = await fetch(`${testBase}/validate/12?limit=3`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label: ' hello ' }),
  });
  assert.equal(response.status, 200);
  const body = envelope.parse(await response.json());
  assert.equal(body.success, true);
  assert.deepEqual(body.data, {
    body: { label: 'hello' },
    params: { id: 12 },
    query: { limit: 3 },
    count: 3,
    originalQuery: { limit: '3' },
  });
  const defaults = await fetch(`${testBase}/validate/12`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"label":"hello"}',
  });
  assert.equal(
    z
      .object({ data: z.object({ query: z.object({ limit: z.number() }) }) })
      .parse(await defaults.json()).data.query.limit,
    20,
  );
});

test('invalid body, params and query produce safe details; unknown keys stay private', async () => {
  const response = await fetch(`${testBase}/validate/nope?limit=200`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"label":" ","SECRET_SENTINEL":"SECRET_SENTINEL"}',
  });
  assert.equal(response.status, 400);
  const body = await failure(response);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(body.meta.requestId, response.headers.get('x-request-id'));
  assert(body.error.details);
  assert.deepEqual(
    body.error.details.map((item: { field: string }) => item.field),
    ['body.label', 'body', 'params.id', 'query.limit'],
  );
  assert(!JSON.stringify(body).includes('SECRET_SENTINEL'));
});

test('dynamic keys and custom validation messages cannot leak input; details are bounded', async () => {
  const response = await fetch(`${testBase}/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      Object.fromEntries(
        Array.from({ length: 30 }, (_, i) => [
          `SECRET_SENTINEL${i}`,
          'SECRET_SENTINEL',
        ]),
      ),
    ),
  });
  const body = await failure(response);
  assert.equal(response.status, 400);
  assert(body.error.details);
  assert.equal(body.error.details.length, 20);
  assert(
    body.error.details.every(
      (item: { field: string }) => item.field === 'body',
    ),
  );
  assert(!JSON.stringify(body).includes('SECRET_SENTINEL'));
});

test('known errors retain safe details; unexpected sync/async/object errors are sanitized', async () => {
  const known = await fetch(`${testBase}/known`);
  assert.equal(known.status, 409);
  assert.deepEqual((await failure(known)).error, {
    code: 'TEST_CONFLICT',
    message: 'Safe conflict',
    details: [{ field: 'body.label', message: 'Unavailable' }],
  });
  for (const route of ['/sync', '/async', '/arbitrary']) {
    const response = await fetch(testBase + route);
    assert.equal(response.status, 500);
    const body = await failure(response);
    assert.deepEqual(body.error, {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
    assert.equal(body.meta.requestId, response.headers.get('x-request-id'));
  }
});

test('async refinements return controlled messages instead of raw custom errors', async () => {
  const response = await fetch(`${testBase}/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"value":"example"}',
  });
  assert.equal(response.status, 400);
  const body = await failure(response);
  assert.deepEqual(body.error.details, [
    { field: 'body.value', message: 'Invalid value' },
  ]);
  assert(!JSON.stringify(body).includes('SECRET_SENTINEL'));
});
