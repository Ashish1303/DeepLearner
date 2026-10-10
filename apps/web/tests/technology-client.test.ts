import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTechnologyClient } from '../src/lib/api/technology-client';
import { ApiError } from '../src/lib/api/client';
const response = () => ({
  success: true,
  message: null,
  data: [
    {
      id: 'a'.repeat(24),
      name: 'Future technology',
      slug: 'future',
      description: null,
      iconAssetId: null,
      order: 0,
    },
  ],
  meta: { requestId: 'test', page: 1, limit: 20, total: 1, totalPages: 1 },
});
test('catalog client sends public fixed-limit GET without auth/cookies and strips extra fields', async () => {
  const raw = response();
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(
      url,
      'http://localhost:4000/api/v1/technologies?page=1&limit=20',
    );
    assert.equal(init?.method, 'GET');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers, undefined);
    return Response.json({
      ...raw,
      data: [
        { ...raw.data[0], status: 'PUBLISHED', createdBy: 'private', __v: 1 },
      ],
    });
  };
  assert.deepEqual(
    await createTechnologyClient('http://localhost:4000/api/v1/', fetcher).list(
      1,
      new AbortController().signal,
    ),
    raw,
  );
});
test('catalog rejects malformed DTO/envelope/pagination and invalid requests before fetch', async () => {
  for (const raw of [
    {},
    { ...response(), success: false },
    { ...response(), data: [{ ...response().data[0], slug: 'future\n' }] },
    { ...response(), data: [response().data[0], response().data[0]] },
    { ...response(), meta: { ...response().meta, limit: 100 } },
    { ...response(), meta: { ...response().meta, page: 2 } },
    { ...response(), meta: { ...response().meta, totalPages: 7 } },
  ])
    await assert.rejects(
      createTechnologyClient('http://localhost/api/v1', async () =>
        Response.json(raw),
      ).list(1, new AbortController().signal),
      (e: unknown) => e instanceof ApiError && e.code === 'INVALID_RESPONSE',
    );
  let calls = 0;
  const client = createTechnologyClient('http://localhost/api/v1', async () => {
    calls++;
    return Response.json(response());
  });
  for (const page of [0, -1, 1.5, Number.MAX_SAFE_INTEGER])
    await assert.rejects(client.list(page, new AbortController().signal));
  assert.equal(calls, 0);
});
test('catalog maps failures safely with one request only, including unexpected 401', async () => {
  for (const [status, code] of [
    [400, 'VALIDATION_ERROR'],
    [401, 'REQUEST_FAILED'],
    [403, 'ORIGIN_NOT_ALLOWED'],
    [429, 'RATE_LIMIT_EXCEEDED'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const) {
    let calls = 0;
    const client = createTechnologyClient(
      'http://localhost/api/v1',
      async () => {
        calls++;
        return Response.json(
          {
            error: {
              message: 'PRIVATE_SENTINEL',
              code: 'AUTH_ACCESS_TOKEN_EXPIRED',
            },
          },
          { status },
        );
      },
    );
    await assert.rejects(
      client.list(1, new AbortController().signal),
      (e: unknown) =>
        e instanceof ApiError &&
        e.code === code &&
        !e.message.includes('PRIVATE_SENTINEL'),
    );
    assert.equal(calls, 1);
  }
});
test('catalog cancellation differs from timeout/network and never retries', async () => {
  const pending: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new Error('PRIVATE_TRANSPORT')),
        { once: true },
      );
    });
  const cancel = new AbortController();
  const promise = createTechnologyClient(
    'http://localhost/api/v1',
    pending,
  ).list(1, cancel.signal);
  cancel.abort();
  await assert.rejects(
    promise,
    (e: unknown) => e instanceof DOMException && e.name === 'AbortError',
  );
  await assert.rejects(
    createTechnologyClient('http://localhost/api/v1', pending, 5).list(
      1,
      new AbortController().signal,
    ),
    (e: unknown) => e instanceof ApiError && e.code === 'NETWORK_ERROR',
  );
  await assert.rejects(
    createTechnologyClient('http://localhost/api/v1', async () => {
      throw new Error('private');
    }).list(1, new AbortController().signal),
    (e: unknown) => e instanceof ApiError && e.code === 'NETWORK_ERROR',
  );
});
test('catalog validates base URL and permits legitimate count/list drift', async () => {
  for (const base of [
    'invalid',
    'https://user:secret@example.com',
    'https://example.com?token=x',
  ])
    assert.throws(() => createTechnologyClient(base), ApiError);
  const raw = {
    ...response(),
    meta: { ...response().meta, total: 0, totalPages: 0 },
  };
  assert.equal(
    (
      await createTechnologyClient('http://localhost/api/v1', async () =>
        Response.json(raw),
      ).list(1, new AbortController().signal)
    ).data.length,
    1,
  );
});
