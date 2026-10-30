import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTechnologyClient,
  TechnologyError,
} from '../src/lib/technologies/technology-client';
import {
  technologyCreate,
  technologyPatch,
  technologyQuery,
  type Technology,
  type TechnologyRequest,
} from '../src/lib/technologies/contracts';

const base = 'http://localhost:4000/api/v1';
const token = 'synthetic-access';
const item: Technology = {
  id: 'a'.repeat(24),
  name: 'TypeScript',
  slug: 'typescript',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const list: TechnologyRequest = { kind: 'list', query: { page: 1, limit: 20 } };
const envelope = (data: unknown, extra = {}) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'synthetic', ...extra },
});
const page = () =>
  envelope([item], { page: 1, limit: 20, total: 1, totalPages: 1 });
const response = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const run = (body: unknown, request: TechnologyRequest = list, status = 200) =>
  createTechnologyClient(base, async () => response(body, status)).execute(
    request,
    token,
    new AbortController().signal,
  );
const invalid = (promise: Promise<unknown>) =>
  assert.rejects(
    promise,
    (e: unknown) =>
      e instanceof TechnologyError && e.code === 'INVALID_RESPONSE',
  );

test('Bearer header injection is refused before a mocked transport can accept it', async () => {
  let calls = 0;
  const client = createTechnologyClient(base, async () => {
    calls++;
    return response(page());
  });
  await assert.rejects(
    client.execute(list, 'synthetic-access\n', new AbortController().signal),
    TechnologyError,
  );
  assert.equal(calls, 0);
});

test('four fixed descriptors produce only the approved method, origin, path, body and Bearer headers', async () => {
  const cases: [TechnologyRequest, number, string, unknown][] = [
    [list, 200, 'GET', page()],
    [{ kind: 'detail', id: item.id }, 200, 'GET', envelope(item)],
    [
      { kind: 'create', input: { name: item.name, slug: item.slug } },
      201,
      'POST',
      envelope(item),
    ],
    [
      { kind: 'patch', id: item.id, input: { revision: 0, name: 'Updated' } },
      200,
      'PATCH',
      envelope({ ...item, name: 'Updated', revision: 1 }),
    ],
  ];
  for (const [request, status, method, body] of cases) {
    let calls = 0;
    const client = createTechnologyClient(base, async (input, init) => {
      calls++;
      assert.equal(
        String(input),
        base +
          '/admin/technologies' +
          (request.kind === 'list'
            ? '?page=1&limit=20'
            : request.kind === 'create'
              ? ''
              : '/' + item.id),
      );
      assert.equal(init?.method, method);
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.redirect, 'error');
      assert.deepEqual(init?.headers, {
        Authorization: 'Bearer ' + token,
        ...(method === 'POST' || method === 'PATCH'
          ? { 'Content-Type': 'application/json' }
          : {}),
      });
      if (request.kind === 'create' || request.kind === 'patch')
        assert.deepEqual(JSON.parse(String(init?.body)), request.input);
      else assert.equal(init?.body, undefined);
      return response(body, status);
    });
    await client.execute(request, token, new AbortController().signal);
    assert.equal(calls, 1);
  }
});
for (const origin of [
  'https://evil.test/api/v1',
  'http://localhost:4000/api/v1?x=1',
  'http://user@localhost:4000/api/v1',
  'http://localhost:4000/other',
  'http://localhost:4000/api/v1#x',
  'https://api.deeplearner.com.evil.test/api/v1',
])
  test('unapproved API base refused: ' + origin, () =>
    assert.throws(() => createTechnologyClient(origin), TechnologyError),
  );
test('invalid descriptors and injected caller fields are refused before dispatch', async () => {
  let calls = 0;
  const client = createTechnologyClient(base, async () => {
    calls++;
    return response(page());
  });
  for (const value of [
    { ...list, url: 'https://evil.test' },
    { kind: 'delete', id: item.id },
    { kind: 'detail', id: item.id + '\n' },
    { kind: 'create', input: { name: 'A', slug: 'a', actorId: item.id } },
    { kind: 'patch', id: item.id, input: { revision: 0, slug: 'new' } },
  ]) {
    await assert.rejects(
      client.execute(
        value as TechnologyRequest,
        token,
        new AbortController().signal,
      ),
      TechnologyError,
    );
  }
  assert.equal(calls, 0);
});
test('strict input boundaries cover immutable fields, safe integers and pagination offset', () => {
  assert(
    technologyCreate.safeParse({
      name: '  A  ',
      slug: 'a',
      description: null,
      order: 0,
    }).success,
  );
  for (const input of [
    { name: 'A', slug: 'a\n' },
    { name: 'A', slug: 'A' },
    { name: 'A', slug: 'a', status: 'PUBLISHED' },
    { name: 'A', slug: 'a', order: Number.MAX_SAFE_INTEGER + 1 },
  ])
    assert(!technologyCreate.safeParse(input).success);
  assert(!technologyPatch.safeParse({ revision: 0 }).success);
  assert(
    !technologyPatch.safeParse({ revision: 0, iconAssetId: null }).success,
  );
  assert(technologyQuery.safeParse({ page: 501, limit: 20 }).success);
  assert(!technologyQuery.safeParse({ page: 502, limit: 20 }).success);
});
for (const patch of [
  { passwordHash: 'synthetic-private' },
  { name: ' padded ' },
  { revision: 0.5 },
  { id: 'a'.repeat(24) + '\n' },
  { createdAt: 'not-a-date' },
  { updatedAt: '2020-01-01T00:00:00.000Z' },
  { description: { private: 'x' } },
  { status: 'DELETED' },
  { iconAssetId: 'https://evil.test' },
])
  test(
    'whole response rejected for invalid or private DTO ' +
      Object.keys(patch).join(','),
    () =>
      invalid(
        run(
          envelope([{ ...item, ...patch }], {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
          }),
        ),
      ),
  );
for (const body of [
  { ...page(), internal: 'private' },
  { ...page(), message: 'internal' },
  {
    ...page(),
    meta: { requestId: 'r', page: 1, limit: 20, total: 1, totalPages: 2 },
  },
  envelope([item, item], { page: 1, limit: 20, total: 2, totalPages: 1 }),
  envelope(
    [
      { ...item, slug: 'z' },
      { ...item, id: 'b'.repeat(24), slug: 'a' },
    ],
    { page: 1, limit: 20, total: 2, totalPages: 1 },
  ),
])
  test(
    'inconsistent envelope or inventory is refused ' +
      JSON.stringify(body).length,
    () => invalid(run(body)),
  );
test('separate count/page snapshots may legitimately have drift', async () => {
  const value = await run(
    envelope([], { page: 1, limit: 20, total: 1, totalPages: 1 }),
  );
  assert('items' in value);
  assert.equal(value.items.length, 0);
});
for (const [status, code, expected] of [
  [401, 'AUTH_ACCESS_TOKEN_EXPIRED', 'AUTH_REQUIRED'],
  [403, 'AUTH_FORBIDDEN', 'FORBIDDEN'],
  [404, 'TECHNOLOGY_NOT_FOUND', 'NOT_FOUND'],
  [409, 'TECHNOLOGY_REVISION_CONFLICT', 'CONFLICT'],
  [429, 'RATE_LIMIT_EXCEEDED', 'RATE_LIMITED'],
  [503, 'DEPENDENCY_UNAVAILABLE', 'UNAVAILABLE'],
] as const)
  test('sanitized error ' + status, async () => {
    await assert.rejects(
      run(
        {
          success: false,
          error: {
            code,
            message: 'SYNTHETIC_INTERNAL_STACK',
            details: [
              { field: 'private', message: 'SYNTHETIC_INTERNAL_DETAIL' },
            ],
          },
          meta: { requestId: 'r' },
        },
        list,
        status,
      ),
      (e: unknown) =>
        e instanceof TechnologyError &&
        e.code === expected &&
        e.status === status &&
        !e.message.includes('SYNTHETIC'),
    );
  });
test('unknown nested error fields and status/code contradictions fail closed', async () => {
  await invalid(
    run(
      {
        success: false,
        error: {
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'x',
          stack: 'private',
        },
        meta: { requestId: 'r' },
      },
      list,
      503,
    ),
  );
  await invalid(
    run(
      {
        success: false,
        error: { code: 'AUTH_FORBIDDEN', message: 'x' },
        meta: { requestId: 'r' },
      },
      list,
      200,
    ),
  );
});
test('detail and mutation responses must match requested identity/revision/state', async () => {
  await invalid(
    run(envelope({ ...item, id: 'b'.repeat(24) }), {
      kind: 'detail',
      id: item.id,
    }),
  );
  await invalid(
    run(
      envelope({ ...item, status: 'PUBLISHED' }),
      { kind: 'create', input: { name: item.name, slug: item.slug } },
      201,
    ),
  );
  await invalid(
    run(envelope(item), {
      kind: 'patch',
      id: item.id,
      input: { revision: 0, name: 'A' },
    }),
  );
});
for (const declared of [undefined, '1'])
  test(
    'actual streamed response cap applies with ' +
      String(declared) +
      ' Content-Length',
    async () => {
      const client = createTechnologyClient(
        base,
        async () =>
          new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array(1048577));
                c.close();
              },
            }),
            {
              headers: {
                'content-type': 'application/json',
                ...(declared ? { 'content-length': declared } : {}),
              },
            },
          ),
      );
      await invalid(client.execute(list, token, new AbortController().signal));
    },
  );
test('invalid UTF-8 and declared oversized data are refused', async () => {
  for (const headers of [
    { 'content-type': 'application/json' },
    { 'content-type': 'application/json', 'content-length': '1048577' },
  ]) {
    const client = createTechnologyClient(
      base,
      async () => new Response(new Uint8Array([255]), { headers }),
    );
    await invalid(client.execute(list, token, new AbortController().signal));
  }
});
test('monotonic deadline is enforced even if timeout callbacks were delayed', async () => {
  let now = 0;
  const client = createTechnologyClient(
    base,
    async () => {
      now = 15001;
      return response(page());
    },
    () => now,
  );
  await assert.rejects(
    client.execute(list, token, new AbortController().signal),
    (e: unknown) => e instanceof TechnologyError && e.code === 'TIMEOUT',
  );
});
test('abort bounds a transport that ignores its signal and does not retry', async () => {
  const abort = new AbortController();
  let calls = 0;
  const client = createTechnologyClient(base, async () => {
    calls++;
    return new Promise<Response>(() => {});
  });
  const pending = client.execute(list, token, abort.signal);
  abort.abort();
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof TechnologyError && e.code === 'CANCELLED',
  );
  assert.equal(calls, 1);
});
test('timeout also bounds a nonresponsive response stream', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = createTechnologyClient(
    base,
    async () =>
      new Response(
        new ReadableStream({
          start() {
            /* Intentionally inert synthetic body. */
          },
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
  );
  const pending = client.execute(list, token, new AbortController().signal);
  const checked = assert.rejects(
    pending,
    (e: unknown) => e instanceof TechnologyError && e.code === 'TIMEOUT',
  );
  await Promise.resolve();
  t.mock.timers.tick(15000);
  await checked;
});

test('multibyte input is byte-bounded before network dispatch', async () => {
  let calls = 0;
  const client = createTechnologyClient(base, async () => {
    calls++;
    return response(envelope(item), 201);
  });
  await assert.rejects(
    client.execute(
      {
        kind: 'create',
        input: { name: 'Draft', slug: 'draft', description: '界'.repeat(1500) },
      },
      token,
      new AbortController().signal,
    ),
    (e: unknown) => e instanceof TechnologyError && e.status === 400,
  );
  assert.equal(calls, 0);
});
for (const [status, code] of [
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
] as const)
  test('canonical request refusal ' + status + ' is sanitized', async () => {
    await assert.rejects(
      run(
        {
          success: false,
          error: { code, message: 'SYNTHETIC_PRIVATE' },
          meta: { requestId: 'r' },
        },
        list,
        status,
      ),
      (e: unknown) =>
        e instanceof TechnologyError &&
        e.code === 'VALIDATION_ERROR' &&
        e.status === status &&
        !e.message.includes('SYNTHETIC'),
    );
  });
