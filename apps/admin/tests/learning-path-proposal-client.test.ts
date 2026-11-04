import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contentSchema,
  draftSchema,
  operationId,
  proposalDto,
  proposalRequest,
  sameContent,
  matchesIntent,
} from '../src/lib/learning-path-proposals/contracts';
import {
  createProposalClient,
  ProposalError,
} from '../src/lib/learning-path-proposals/proposal-client';
const technologyId = 'a'.repeat(24),
  family = 'b'.repeat(24),
  revisionId = 'c'.repeat(24);
const key = '11111111-1111-4111-8111-111111111111';
const content = {
  title: 'Synthetic brief',
  objectives: ['One objective'],
  audience: 'Developers',
  depth: 'BEGINNER' as const,
  runtime: null,
  technologyVersion: null,
  prerequisites: [],
};
const dto = {
  ...content,
  id: revisionId,
  proposalId: family,
  technologyId,
  revision: 1,
  schemaVersion: 1,
  source: { id: family, revision: 1 },
  createdAt: '2026-11-04T00:00:00.000Z',
};
const capture = {
  kind: 'capture',
  input: { ...content, technologyId, operationId: key },
} as const;
const wrap = (data: unknown) => ({
  success: true,
  data,
  message: null,
  meta: { requestId: 'synthetic-u' },
});
const response = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  });
const run = (fetcher: typeof fetch, request = capture) =>
  createProposalClient('http://127.0.0.1:4000/api/v1', fetcher).execute(
    request,
    'synthetic-access',
    new AbortController().signal,
  );

test('exact browser content parity: required keys, nulls, order and no normalization', () => {
  assert(contentSchema.safeParse(content).success);
  assert(draftSchema.safeParse({ ...content, title: '', depth: '' }).success);
  assert(!contentSchema.safeParse({ ...content, title: ' title ' }).success);
  assert(!contentSchema.safeParse({ ...content, technologyId }).success);
  assert(!contentSchema.safeParse({ ...content, runtime: {} }).success);
  assert(
    !contentSchema.safeParse({ ...content, technologyVersion: '' }).success,
  );
  assert(
    !contentSchema.safeParse({ ...content, actorId: technologyId }).success,
  );
  assert(sameContent(content, { ...content, title: content.title }));
  assert(
    !sameContent(
      { ...content, objectives: ['A', 'B'] },
      { ...content, objectives: ['B', 'A'] },
    ),
  );
  assert(
    contentSchema.safeParse({ ...content, objectives: ['A', 'a'] }).success,
  );
  assert(
    !contentSchema.safeParse({ ...content, objectives: ['A', 'A'] }).success,
  );
  assert(
    !contentSchema.safeParse({
      ...content,
      prerequisites: [{ description: 'A' }, { description: 'A' }],
    }).success,
  );
});
for (const [field, max] of [
  ['title', 120],
  ['audience', 500],
] as const)
  test(field + ' exact length boundaries', () => {
    for (const n of [1, max])
      assert(
        contentSchema.safeParse({ ...content, [field]: 'x'.repeat(n) }).success,
      );
    for (const n of [0, max + 1])
      assert(
        !contentSchema.safeParse({ ...content, [field]: 'x'.repeat(n) })
          .success,
      );
  });
test('ordered row and runtime/version exact boundaries', () => {
  assert(
    contentSchema.safeParse({
      ...content,
      objectives: Array.from(
        { length: 20 },
        (_, i) => String(i) + 'x'.repeat(238),
      ),
      prerequisites: Array.from({ length: 20 }, (_, i) => ({
        description: String(i),
      })),
    }).success,
  );
  for (const values of [
    [],
    Array.from({ length: 21 }, (_, i) => String(i)),
    ['x'.repeat(241)],
  ])
    assert(
      !contentSchema.safeParse({ ...content, objectives: values }).success,
    );
  assert(
    contentSchema.safeParse({
      ...content,
      runtime: { name: 'x'.repeat(80), version: 'y'.repeat(80) },
      technologyVersion: 'z'.repeat(80),
    }).success,
  );
  for (const value of ['', 'x'.repeat(81)]) {
    assert(
      !contentSchema.safeParse({
        ...content,
        runtime: { name: value, version: null },
      }).success,
    );
    assert(
      !contentSchema.safeParse({
        ...content,
        runtime: { name: 'Runtime', version: value },
      }).success,
    );
    assert(
      !contentSchema.safeParse({ ...content, technologyVersion: value })
        .success,
    );
  }
  assert(
    !contentSchema.safeParse({
      ...content,
      prerequisites: [{ description: 'x', unexpected: true }],
    }).success,
  );
});
for (const bad of [
  '\n',
  '\r',
  '\t',
  '\0',
  '\x7f',
  '\u0085',
  '\u2028',
  '\u2029',
  '\ud800',
  '\udfff',
])
  test('reject forbidden Unicode U+' + bad.charCodeAt(0).toString(16), () => {
    assert(
      !contentSchema.safeParse({ ...content, title: 'a' + bad + 'b' }).success,
    );
  });
test('valid astral Unicode preserves UTF-16 bounds and exact bytes', () => {
  assert(
    contentSchema.safeParse({ ...content, title: '😀'.repeat(60) }).success,
  );
  assert(
    !contentSchema.safeParse({ ...content, title: '😀'.repeat(61) }).success,
  );
});
test('canonical request identities and private DTO allowlists reject extra fields', () => {
  assert(proposalDto.safeParse(dto).success);
  assert(operationId.safeParse(key).success);
  for (const id of [key.toUpperCase().replace('1111', 'AAAA'), key + '\n', 'x'])
    assert(!operationId.safeParse(id).success);
  assert(
    !proposalRequest.safeParse({
      kind: 'capture',
      technologyId,
      input: content,
      operationId: key,
    }).success,
  );
  assert(
    !proposalRequest.safeParse({ kind: 'recover', operationId: key }).success,
  );
  for (const extra of [
    { token: 'private' },
    { actorId: family },
    { definitionDigest: '0'.repeat(64) },
    { source: { ...dto.source, digest: '0'.repeat(64) } },
    { source: { id: technologyId, revision: 1 } },
    { createdAt: 'yesterday' },
    { revision: 0 },
    { id: family },
  ])
    assert(!proposalDto.safeParse({ ...dto, ...extra }).success);
  assert(matchesIntent(dto, technologyId, content));
  assert(!matchesIntent({ ...dto, title: 'Other' }, technologyId, content));
});
test('fixed capture transport maps exact nine fields and keeps credential material internal', async () => {
  let count = 0,
    dispatched = 0;
  const client = createProposalClient(
    'http://127.0.0.1:4000/api/v1',
    async (url, init) => {
      count++;
      assert.equal(
        url,
        'http://127.0.0.1:4000/api/v1/admin/learning-path-proposals',
      );
      assert.equal(init?.method, 'POST');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.redirect, 'error');
      assert.deepEqual(JSON.parse(init?.body as string), capture.input);
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer synthetic-access',
      );
      return response(wrap(dto));
    },
  );
  assert.deepEqual(
    await client.execute(
      capture,
      'synthetic-access',
      new AbortController().signal,
      {
        remaining: () => 15000,
        dispatched() {
          dispatched++;
        },
      },
    ),
    dto,
  );
  assert.equal(count, 1);
  assert.equal(dispatched, 1);
});
test('fixed bound recovery/detail GETs carry no body or mutation', async () => {
  const urls: string[] = [];
  const client = createProposalClient(
    'http://127.0.0.1:4000/api/v1/',
    async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.method, 'GET');
      assert.equal(init?.body, undefined);
      return response(
        wrap(urls.length === 1 ? { state: 'COMMITTED', proposal: dto } : dto),
      );
    },
  );
  await client.execute(
    { kind: 'recover', technologyId, operationId: key },
    'synthetic',
    new AbortController().signal,
  );
  await client.execute(
    { kind: 'detail', technologyId, id: revisionId },
    'synthetic',
    new AbortController().signal,
  );
  assert(
    urls[0]?.endsWith('/operations/' + key + '?technologyId=' + technologyId),
  );
  assert(urls[1]?.endsWith('/' + revisionId + '?technologyId=' + technologyId));
});
for (const base of [
  'https://evil.example/api/v1',
  'http://127.0.0.1:5173/api/v1',
  'http://private@localhost:4000/api/v1',
  'http://localhost:4000/api/v1?x=1',
  'http://localhost:4000/api/v1/#hash',
  'http://localhost:4000/other',
])
  test('refuse unapproved API base ' + base, () =>
    assert.throws(() => createProposalClient(base), ProposalError),
  );
for (const [status, code] of [
  [400, 'VALIDATION_ERROR'],
  [404, 'TECHNOLOGY_NOT_FOUND'],
  [409, 'PROPOSAL_CONFLICT'],
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
  [429, 'RATE_LIMIT_EXCEEDED'],
  [503, 'PROPOSAL_OUTCOME_UNKNOWN'],
] as const)
  test(
    'fixed sanitized ' +
      status +
      ' ' +
      code +
      ' classification, no automatic replay',
    async () => {
      let calls = 0;
      await assert.rejects(
        run(async () => {
          calls++;
          return response(
            {
              success: false,
              error: {
                code,
                message: 'PRIVATE_EXCEPTION',
                details: [{ field: 'private.path', message: 'PRIVATE_DETAIL' }],
              },
              meta: { requestId: 'synthetic' },
            },
            { status },
          );
        }),
        (e: unknown) =>
          e instanceof ProposalError &&
          e.status === status &&
          !e.message.includes('PRIVATE') &&
          e.definitive === [400, 404, 413, 415, 429].includes(status),
      );
      assert.equal(calls, 1);
    },
  );
for (const status of [401, 403])
  test(
    'authority refusal ' + status + ' recognized even with corrupt body',
    async () => {
      await assert.rejects(
        run(async () => new Response('PRIVATE_TEXT', { status })),
        (e: unknown) =>
          e instanceof ProposalError && e.status === status && !e.definitive,
      );
    },
  );
for (const [label, data, init] of [
  ['extra envelope', { ...wrap(dto), private: 'secret' }, {}],
  ['extra DTO', wrap({ ...dto, stack: 'secret' }), {}],
  ['wrong parent', wrap({ ...dto, technologyId: family }), {}],
  ['wrong initial revision', wrap({ ...dto, revision: 2 }), {}],
  [
    'missing no-store',
    wrap(dto),
    { headers: { 'Cache-Control': 'max-age=0' } },
  ],
  ['wrong status', wrap(dto), { status: 201 }],
  ['oversized length', wrap(dto), { headers: { 'Content-Length': '131073' } }],
  ['invalid length', wrap(dto), { headers: { 'Content-Length': 'wat' } }],
  [
    'unknown error',
    {
      success: false,
      error: { code: 'UNKNOWN', message: 'secret' },
      meta: { requestId: 'x' },
    },
    { status: 500 },
  ],
] as const)
  test(
    'reject ' + label + ' as ambiguous, never a definitive failure',
    async () => {
      await assert.rejects(
        run(async () => response(data, init)),
        (e: unknown) =>
          e instanceof ProposalError &&
          e.code === 'INVALID_RESPONSE' &&
          !e.definitive,
      );
    },
  );
test('stream byte bounds, invalid JSON and fatal UTF-8 reject without exposing payload', async () => {
  for (const bytes of [
    new Uint8Array(131073),
    new Uint8Array([0xff]),
    new TextEncoder().encode('PRIVATE_INVALID_JSON'),
  ])
    await assert.rejects(
      run(
        async () =>
          new Response(bytes, {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
            },
          }),
      ),
      (e: unknown) =>
        e instanceof ProposalError &&
        e.code === 'INVALID_RESPONSE' &&
        !e.message.includes('PRIVATE'),
    );
});
test('whole budget includes prior queue time and late timeout callback cannot admit success', async () => {
  let left = 10,
    calls = 0;
  const client = createProposalClient(
    'http://localhost:4000/api/v1',
    async () => {
      calls++;
      left = 0;
      return response(wrap(dto));
    },
  );
  await assert.rejects(
    client.execute(capture, 'synthetic', new AbortController().signal, {
      remaining: () => left,
      dispatched() {},
    }),
    (e: unknown) => e instanceof ProposalError && e.code === 'TIMEOUT',
  );
  assert.equal(calls, 1);
});
test('pre-aborted request never dispatches, ignored transport cancellation still settles once', async () => {
  const abort = new AbortController();
  abort.abort();
  let count = 0;
  const client = createProposalClient(
    'http://localhost:4000/api/v1',
    async () => {
      count++;
      return new Promise(() => {});
    },
  );
  await assert.rejects(
    client.execute(capture, 'synthetic', abort.signal),
    ProposalError,
  );
  assert.equal(count, 0);
  const active = new AbortController();
  const work = client.execute(capture, 'synthetic', active.signal);
  active.abort();
  await assert.rejects(work, ProposalError);
  assert.equal(count, 1);
});
