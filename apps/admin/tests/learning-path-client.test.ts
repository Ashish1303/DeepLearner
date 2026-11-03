import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLearningPathClient,
  LearningPathError,
} from '../src/lib/learning-paths/learning-path-client';
import {
  learningPathRequest,
  type LearningPath,
  type LearningPathRequest,
} from '../src/lib/learning-paths/contracts';

const base = 'http://127.0.0.1:4000/api/v1';
const parent = 'a'.repeat(24);
const item: LearningPath = {
  id: 'b'.repeat(24),
  technologyId: parent,
  title: 'Foundations',
  slug: 'foundations',
  description: null,
  targetLevel: null,
  completionScore: 80,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
};
const list: LearningPathRequest = {
  kind: 'list',
  query: { technologyId: parent, page: 1, limit: 20 },
};
const envelope = (data: unknown, extra = {}) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'synthetic', ...extra },
});
const page = () =>
  envelope([item], { page: 1, limit: 20, total: 1, totalPages: 1 });
const response = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const run = (
  body: unknown,
  request: LearningPathRequest = list,
  status = 200,
) =>
  createLearningPathClient(base, async () => response(body, status)).execute(
    request,
    'synthetic-access',
    new AbortController().signal,
  );
const invalid = (promise: Promise<unknown>) =>
  assert.rejects(
    promise,
    (e: unknown) =>
      e instanceof LearningPathError && e.code === 'INVALID_RESPONSE',
  );

for (const request of [
  list,
  { kind: 'detail', technologyId: parent, id: item.id } as const,
])
  test(
    request.kind +
      ' binds exact parent, GET, fixed origin and private no-cookie transport',
    async () => {
      let calls = 0;
      const client = createLearningPathClient(base, async (url, init) => {
        calls++;
        assert.equal(
          String(url),
          base +
            '/admin/learning-paths' +
            (request.kind === 'list'
              ? `?technologyId=${parent}&page=1&limit=20`
              : `/${item.id}?technologyId=${parent}`),
        );
        assert.equal(init?.method, 'GET');
        assert.equal(init?.credentials, 'omit');
        assert.equal(init?.cache, 'no-store');
        assert.equal(init?.redirect, 'error');
        assert.equal(init?.body, undefined);
        assert.deepEqual(init?.headers, {
          Authorization: 'Bearer synthetic-access',
        });
        return response(request.kind === 'list' ? page() : envelope(item));
      });
      await client.execute(
        request,
        'synthetic-access',
        new AbortController().signal,
      );
      assert.equal(calls, 1);
    },
  );
for (const raw of [
  { kind: 'create', input: {} },
  { kind: 'detail', id: item.id },
  { ...list, url: 'https://untrusted.test' },
  { kind: 'detail', id: item.id, technologyId: parent.toUpperCase() },
  ...[0, -1, 1.5, 502, NaN].map((page) => ({
    kind: 'list',
    query: { technologyId: parent, page, limit: 20 },
  })),
  { kind: 'list', query: { technologyId: parent, page: 1, limit: 101 } },
  { kind: 'list', query: { technologyId: parent, page: '1', limit: 20 } },
])
  test(
    'invalid fixed request ' +
      JSON.stringify(raw) +
      ' refuses before transport',
    async () => {
      let calls = 0;
      assert(!learningPathRequest.safeParse(raw).success);
      const client = createLearningPathClient(base, async () => {
        calls++;
        return response(page());
      });
      await assert.rejects(
        client.execute(
          raw as LearningPathRequest,
          'synthetic-access',
          new AbortController().signal,
        ),
        LearningPathError,
      );
      assert.equal(calls, 0);
    },
  );
for (const url of [
  'http://untrusted.test/api/v1',
  'http://127.0.0.1:27017/api/v1',
  base + '?x=1',
  base + '#x',
  'http://user:pass@127.0.0.1:4000/api/v1',
  base + '/admin',
])
  test('unapproved endpoint is refused: ' + url.replace('user:pass@', ''), () =>
    assert.throws(() => createLearningPathClient(url), LearningPathError),
  );
for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)
  test('accepts actual read-only status ' + status, async () => {
    const out = await run(envelope({ ...item, status }), {
      kind: 'detail',
      id: item.id,
      technologyId: parent,
    });
    assert.equal('status' in out && out.status, status);
  });
for (const [label, change] of [
  ['private actor', { createdBy: parent }],
  ['nested private field', { extra: { stack: 'synthetic' } }],
  ['unknown status', { status: 'APPROVED' }],
  ['wrong parent', { technologyId: 'c'.repeat(24) }],
  ['uppercase id', { id: 'B'.repeat(24) }],
  ['untrimmed title', { title: ' bad ' }],
  ['bad timestamp', { updatedAt: '2026-11-03' }],
  ['time reversal', { updatedAt: '2026-11-02T00:00:00.000Z' }],
  ['missing target', { targetLevel: undefined }],
  ['invalid threshold', { completionScore: 101 }],
  ['operator', { $set: {} }],
] as const)
  test('raw DTO rejects ' + label, () =>
    invalid(run({ ...page(), data: [{ ...item, ...change }] })),
  );
for (const [label, body] of [
  ['envelope private data', { ...page(), private: {} }],
  [
    'meta private data',
    { ...page(), meta: { ...page().meta, stack: 'synthetic' } },
  ],
  ['wrong page', { ...page(), meta: { ...page().meta, page: 2 } }],
  ['wrong limit', { ...page(), meta: { ...page().meta, limit: 10 } }],
  [
    'inconsistent total',
    { ...page(), meta: { ...page().meta, total: 0, totalPages: 0 } },
  ],
  ['missing rows', { ...page(), data: [] }],
  ['wrong total pages', { ...page(), meta: { ...page().meta, totalPages: 2 } }],
  [
    'duplicate ids',
    envelope([item, item], { page: 1, limit: 20, total: 2, totalPages: 1 }),
  ],
  [
    'wrong order',
    envelope(
      [
        { ...item, order: 2 },
        { ...item, id: 'c'.repeat(24), slug: 'other', order: 1 },
      ],
      { page: 1, limit: 20, total: 2, totalPages: 1 },
    ),
  ],
] as const)
  test('pagination/privacy refuses ' + label, () => invalid(run(body)));
test('valid later empty page is accepted', async () => {
  const out = await run(
    envelope([], { page: 2, limit: 20, total: 1, totalPages: 1 }),
    { kind: 'list', query: { technologyId: parent, page: 2, limit: 20 } },
  );
  assert('items' in out && out.items.length === 0);
});
test('detail rejects a different record even with correct parent', () =>
  invalid(
    run(envelope(item), {
      kind: 'detail',
      id: 'd'.repeat(24),
      technologyId: parent,
    }),
  ));
for (const [status, code, expected] of [
  [400, 'VALIDATION_ERROR', 'VALIDATION_ERROR'],
  [401, 'AUTH_ACCESS_TOKEN_EXPIRED', 'AUTH_REQUIRED'],
  [403, 'AUTH_FORBIDDEN', 'FORBIDDEN'],
  [404, 'TECHNOLOGY_NOT_FOUND', 'PARENT_NOT_FOUND'],
  [404, 'LEARNING_PATH_NOT_FOUND', 'NOT_FOUND'],
  [429, 'RATE_LIMIT_EXCEEDED', 'RATE_LIMITED'],
  [503, 'DEPENDENCY_UNAVAILABLE', 'UNAVAILABLE'],
  [500, 'INTERNAL_ERROR', 'UNAVAILABLE'],
] as const)
  test('sanitizes ' + status + '/' + code, async () => {
    await assert.rejects(
      run(
        {
          success: false,
          error: { code, message: 'SYNTHETIC_PRIVATE_INTERNAL' },
          meta: { requestId: 'synthetic' },
        },
        list,
        status,
      ),
      (e: unknown) =>
        e instanceof LearningPathError &&
        e.code === expected &&
        !e.message.includes('PRIVATE'),
    );
  });
for (const error of [
  { code: 'DEPENDENCY_UNAVAILABLE', message: 'safe', stack: 'synthetic' },
  {
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'safe',
    details: [{ field: 'x', message: 'synthetic' }],
  },
  {
    code: 'VALIDATION_ERROR',
    message: 'safe',
    details: [{ field: 'x', message: 'safe', stack: 'synthetic' }],
  },
])
  test(
    'raw error allowlist refuses hidden fields ' +
      JSON.stringify(Object.keys(error)),
    () =>
      invalid(
        run(
          { success: false, error, meta: { requestId: 'synthetic' } },
          list,
          error.code === 'VALIDATION_ERROR' ? 400 : 503,
        ),
      ),
  );
test('2 MiB body limit refuses claimed and actual oversized responses', async () => {
  await invalid(
    createLearningPathClient(base, async () =>
      response(page(), 200, { 'content-length': '2097153' }),
    ).execute(list, 'synthetic', new AbortController().signal),
  );
  await invalid(
    createLearningPathClient(
      base,
      async () =>
        new Response(' '.repeat(2097153), {
          headers: { 'content-type': 'application/json' },
        }),
    ).execute(list, 'synthetic', new AbortController().signal),
  );
});
test('aborted pending transport rejects once and cleans its timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const abort = new AbortController();
  let calls = 0;
  const pending = createLearningPathClient(base, () => {
    calls++;
    return new Promise(() => {});
  }).execute(list, 'synthetic', abort.signal);
  const check = assert.rejects(
    pending,
    (e: unknown) => e instanceof LearningPathError && e.code === 'CANCELLED',
  );
  abort.abort();
  await check;
  t.mock.timers.tick(30000);
  assert.equal(calls, 1);
});
test('deadline stops a noncooperative transport with no retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const pending = createLearningPathClient(base, () => {
    calls++;
    return new Promise(() => {});
  }).execute(list, 'synthetic', new AbortController().signal);
  const check = assert.rejects(
    pending,
    (e: unknown) => e instanceof LearningPathError && e.code === 'TIMEOUT',
  );
  t.mock.timers.tick(15000);
  await check;
  assert.equal(calls, 1);
});
test('final monotonic check refuses delayed timeout callbacks', async () => {
  let time = 0;
  const client = createLearningPathClient(
    base,
    async () => {
      time = 15001;
      return response(page());
    },
    () => time,
  );
  await assert.rejects(
    client.execute(list, 'synthetic', new AbortController().signal),
    (e: unknown) => e instanceof LearningPathError && e.code === 'TIMEOUT',
  );
});
test('network exceptions never expose internal messages', async () => {
  await assert.rejects(
    createLearningPathClient(base, async () => {
      throw Error('SYNTHETIC_PRIVATE');
    }).execute(list, 'synthetic', new AbortController().signal),
    (e: unknown) =>
      e instanceof LearningPathError &&
      e.code === 'NETWORK_ERROR' &&
      !e.message.includes('PRIVATE'),
  );
});
