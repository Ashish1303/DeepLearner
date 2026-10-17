import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPracticeClient } from '../src/lib/api/practice-client';
import { practiceEnvelope } from '../src/lib/practice/contracts';
const id = 'a'.repeat(24);
const item = {
  id,
  conceptId: id,
  type: 'OUTPUT',
  difficulty: 'BEGINNER',
  prompt: 'Predict',
  starterCode: '  const x = "<script>";\n',
  language: 'JAVASCRIPT',
};
const body = () => ({
  success: true,
  message: null,
  data: [{ ...item }],
  meta: { requestId: 'test', page: 1, limit: 10, total: 1, totalPages: 1 },
});
test('practice GET uses fixed URL, private bearer, omitted cookies and no-store', async () => {
  let calls = 0;
  const client = createPracticeClient(
    'http://127.0.0.1:4000/api/v1',
    async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        `http://127.0.0.1:4000/api/v1/practice-questions?conceptId=${id}&page=1&limit=10`,
      );
      assert.equal(init?.method, 'GET');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.redirect, 'error');
      assert.deepEqual(init?.headers, { Authorization: 'Bearer synthetic' });
      assert.equal(init?.body, undefined);
      return Response.json(body());
    },
  );
  const result = await client.load(
    id,
    1,
    'synthetic',
    new AbortController().signal,
  );
  assert.equal(result.data[0]?.starterCode, item.starterCode);
  assert.equal(calls, 1);
});
test('client rejects secret keys, wrong identity, pagination/order and malformed contracts', async () => {
  const cases: unknown[] = [
    { ...body(), extra: 'SECRET' },
    { ...body(), data: [{ ...item, answer: 'SECRET' }] },
    { ...body(), data: [{ ...item, conceptId: 'b'.repeat(24) }] },
    { ...body(), meta: { ...body().meta, page: 2 } },
    { ...body(), meta: { ...body().meta, totalPages: 3 } },
    { ...body(), data: [item, item] },
    { ...body(), data: [{ ...item, starterCode: 1 }] },
    { ...body(), data: [{ ...item, prompt: ' ' }] },
    { ...body(), data: [{ ...item, starterCode: 'code', language: null }] },
  ];
  for (const value of cases) {
    const client = createPracticeClient('http://localhost/api', async () =>
      Response.json(value),
    );
    await assert.rejects(
      client.load(id, 1, 'synthetic', new AbortController().signal),
      { code: 'INVALID_RESPONSE' },
    );
  }
  assert.equal(
    practiceEnvelope.safeParse({
      ...body(),
      data: [],
      meta: { ...body().meta, total: 0, totalPages: 0 },
    }).success,
    true,
  );
});
test('external cancellation survives response parsing; timeout and unsafe bases fail safely', async () => {
  const abort = new AbortController();
  const client = createPracticeClient('http://localhost/api', async () => {
    abort.abort();
    return Response.json(body());
  });
  await assert.rejects(client.load(id, 1, 'secret', abort.signal), {
    name: 'AbortError',
  });
  for (const base of [
    'https://user:pass@host/api',
    'javascript:alert(1)',
    'https://host/api?x=1',
  ])
    assert.throws(() => createPracticeClient(base));
  const timeout = createPracticeClient(
    'http://localhost',
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init!.signal!.addEventListener('abort', () =>
          reject(new Error('aborted')),
        ),
      ),
    1,
  );
  await assert.rejects(
    timeout.load(id, 1, 'secret', new AbortController().signal),
    { code: 'NETWORK_ERROR' },
  );
});
test('client preserves auth and safe local error categories without server-message leakage', async () => {
  for (const [status, code] of [
    [401, 'AUTH_ACCESS_TOKEN_EXPIRED'],
    [403, 'AUTH_ACCOUNT_DISABLED'],
    [404, 'USER_NOT_FOUND'],
    [429, 'RATE_LIMIT_EXCEEDED'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const) {
    const client = createPracticeClient('http://localhost', async () =>
      Response.json(
        {
          success: false,
          error: { code, message: 'SECRET' },
          meta: { requestId: 'test' },
        },
        { status },
      ),
    );
    await assert.rejects(
      client.load(id, 1, 'secret', new AbortController().signal),
      (error: unknown) =>
        error instanceof Error &&
        'code' in error &&
        error.code === code &&
        !error.message.includes('SECRET'),
    );
  }
});
