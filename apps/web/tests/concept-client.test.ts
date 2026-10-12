import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createConceptClient,
  ConceptError,
} from '../src/lib/api/concept-client';
import {
  conceptSchema,
  conceptListEnvelope,
  summarySchema,
} from '../src/lib/concepts/contracts';
const tech = 'a'.repeat(24),
  pathId = 'b'.repeat(24),
  moduleId = 'c'.repeat(24),
  topicId = 'd'.repeat(24),
  id = 'e'.repeat(24);
const summary = {
  id,
  technologyId: tech,
  learningPathId: pathId,
  moduleId,
  topicId,
  title: 'Concept',
  slug: 'concept',
  difficulty: 'BEGINNER',
  order: 0,
  summary: 'Summary',
};
const { summary: short, ...identity } = summary;
const concept = {
  ...identity,
  contentFormat: 'MARKDOWN',
  schemaVersion: 1,
  read: { summary: short, bodyMarkdown: '# Read\n\nBody' },
  source: {
    label: 'Reference',
    url: 'https://example.invalid/docs',
    sourceType: 'OFFICIAL_OR_TRUSTED',
    isOfficial: true,
  },
};
const path = {
  id: pathId,
  technologyId: tech,
  title: 'Path',
  slug: 'path',
  description: null,
  order: 0,
  targetLevel: null,
  completionScore: 70,
};
const moduleRecord = {
  id: moduleId,
  technologyId: tech,
  learningPathId: pathId,
  title: 'Module',
  slug: 'module',
  description: null,
  order: 0,
};
const topic = {
  ...moduleRecord,
  id: topicId,
  moduleId,
  title: 'Topic',
  slug: 'topic',
};
const detail = (data: unknown) => ({
  success: true,
  message: null,
  data,
  meta: { requestId: 'synthetic' },
});
const list = (data = [summary], page = 1, total = data.length) => ({
  ...detail(data),
  data,
  meta: {
    requestId: 'synthetic',
    page,
    limit: 20,
    total,
    totalPages: Math.ceil(total / 20),
  },
});
const base = 'http://localhost:4000/api/v1';
function fixture(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const records: Record<string, unknown> = {
    ['/topics/' + topicId]: detail(topic),
    ['/modules/' + moduleId]: detail(moduleRecord),
    ['/learning-paths/' + pathId]: detail(path),
    ['/concepts/' + id]: detail(concept),
    [`/concepts?topicId=${topicId}&page=1&limit=20`]: list(),
    ...overrides,
  };
  const client = createConceptClient(base, async (url, init) => {
    assert.equal(init?.method, 'GET');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers, undefined);
    const key = String(url).slice(base.length);
    calls.push(key);
    assert(Object.hasOwn(records, key));
    return Response.json(records[key]);
  });
  return { client, calls };
}
const signal = () => new AbortController().signal;
const kind = (name: ConceptError['kind']) => (error: unknown) =>
  error instanceof ConceptError && error.kind === name;
test('Concept list/detail use credential-free GETs and validated real ancestry', async () => {
  const { client, calls } = fixture();
  const result = await client.load('topic', topicId.toUpperCase(), 1, signal());
  assert.equal(result.items[0]!.title, 'Concept');
  assert.equal(result.concept, null);
  assert.equal(calls.length, 4);
  const read = await client.load('concept', id, 1, signal());
  assert.deepEqual(read.concept, concept);
  assert.equal(read.crumbs.at(-1)?.href, '/topics/' + topicId);
});
test('list preserves ordering and accepts empty out-of-range pages', async () => {
  const rows = [
    summary,
    { ...summary, id: 'f'.repeat(24), title: 'Another', order: 1 },
  ];
  const result = await fixture({
    [`/concepts?topicId=${topicId}&page=1&limit=20`]: list(rows),
  }).client.load('topic', topicId, 1, signal());
  assert.deepEqual(
    result.items.map((item) => item.title),
    ['Concept', 'Another'],
  );
  const empty = await fixture({
    [`/concepts?topicId=${topicId}&page=2&limit=20`]: list([], 2, 1),
  }).client.load('topic', topicId, 2, signal());
  assert.equal(empty.totalPages, 1);
  assert.deepEqual(empty.items, []);
});
test('request ID and totalPages validation are independent', () => {
  const invalidId = list();
  invalidId.meta.requestId = ' ';
  const a = conceptListEnvelope.safeParse(invalidId);
  assert(!a.success);
  assert(
    a.error.issues.some(
      (issue) =>
        issue.path.join('.') === 'meta.requestId' && issue.code === 'custom',
    ),
  );
  const invalidPages = list();
  invalidPages.meta.totalPages = 2;
  const b = conceptListEnvelope.safeParse(invalidPages);
  assert(!b.success);
  assert(
    b.error.issues.some(
      (issue) => issue.path.join('.') === 'meta' && issue.code === 'custom',
    ),
  );
});
test('schemas enforce exact Concept bounds, Markdown/source contract and strip internal fields', () => {
  assert.deepEqual(
    conceptSchema.parse({
      ...concept,
      status: 'PUBLISHED',
      secret: 'not-for-ui',
    }),
    concept,
  );
  assert(
    conceptSchema.safeParse({
      ...concept,
      read: { summary: 's'.repeat(2000), bodyMarkdown: 'x'.repeat(50000) },
    }).success,
  );
  for (const bad of [
    { ...concept, id: id + '\n' },
    { ...concept, title: ' ' },
    { ...concept, title: 'x'.repeat(121) },
    { ...concept, slug: 'bad\n' },
    { ...concept, difficulty: 'EXPERT' },
    { ...concept, order: Number.MAX_SAFE_INTEGER + 1 },
    { ...concept, schemaVersion: 2 },
    { ...concept, contentFormat: 'HTML' },
    { ...concept, read: { ...concept.read, bodyMarkdown: ' ' } },
    { ...concept, read: { ...concept.read, bodyMarkdown: 'x'.repeat(50001) } },
    ...[
      'javascript:alert(1)',
      'http://example.invalid',
      'https://user:pass@example.invalid',
      'not a url',
    ].map((url) => ({ ...concept, source: { ...concept.source, url } })),
    { ...concept, source: { ...concept.source, sourceType: 'OTHER' } },
    { ...concept, source: { ...concept.source, isOfficial: undefined } },
  ])
    assert(!conceptSchema.safeParse(bad).success);
  assert(
    !summarySchema.safeParse({ ...summary, summary: 'x'.repeat(2001) }).success,
  );
  assert(!conceptListEnvelope.safeParse(list([summary, summary])).success);
  assert(!conceptListEnvelope.safeParse(list([], 1, 2)).success);
});
test('invalid IDs/pages fail before requests', async () => {
  const { client, calls } = fixture();
  for (const bad of ['', '../', topicId + '\n'])
    await assert.rejects(
      client.load('topic', bad, 1, signal()),
      kind('invalid'),
    );
  for (const page of [0, -1, 1.5, Number.MAX_SAFE_INTEGER])
    await assert.rejects(
      client.load('topic', topicId, page, signal()),
      kind('invalid'),
    );
  assert.deepEqual(calls, []);
});
test('all mismatched parent and Concept/list references fail closed', async () => {
  const other = '1'.repeat(24);
  const variants = [
    { ['/topics/' + topicId]: detail({ ...topic, id: other }) },
    ...['id', 'technologyId', 'learningPathId'].map((field) => ({
      ['/modules/' + moduleId]: detail({ ...moduleRecord, [field]: other }),
    })),
    ...['id', 'technologyId'].map((field) => ({
      ['/learning-paths/' + pathId]: detail({ ...path, [field]: other }),
    })),
    ...['moduleId', 'learningPathId', 'technologyId'].map((field) => ({
      ['/concepts/' + id]: detail({ ...concept, [field]: other }),
    })),
  ];
  for (const records of variants)
    await assert.rejects(
      fixture(records).client.load('concept', id, 1, signal()),
      kind('malformed'),
    );
  for (const field of ['topicId', 'moduleId', 'learningPathId', 'technologyId'])
    await assert.rejects(
      fixture({
        [`/concepts?topicId=${topicId}&page=1&limit=20`]: list([
          { ...summary, [field]: other },
        ]),
      }).client.load('topic', topicId, 1, signal()),
      kind('malformed'),
    );
});
test('HTTP failures are safe and never retried or turned into auth requests', async () => {
  for (const [status, expected] of [
    [400, 'invalid'],
    [403, 'forbidden'],
    [404, 'missing'],
    [429, 'limited'],
    [503, 'unavailable'],
    [401, 'failed'],
  ] as const) {
    let calls = 0;
    const client = createConceptClient(base, async () => {
      calls++;
      return Response.json(
        {
          success: false,
          error: { code: 'SYNTHETIC', message: 'private server diagnostic' },
          meta: { requestId: 'test' },
        },
        { status },
      );
    });
    await assert.rejects(
      client.load('topic', topicId, 1, signal()),
      (error) =>
        kind(expected)(error) && !(error as Error).message.includes('private'),
    );
    assert.equal(calls, 1);
  }
});
test('malformed responses and request page mismatch are rejected', async () => {
  for (const raw of [{}, { ...detail(concept), meta: { requestId: '' } }]) {
    const client = createConceptClient(base, async () => Response.json(raw));
    await assert.rejects(
      client.load('concept', id, 1, signal()),
      kind('malformed'),
    );
  }
  await assert.rejects(
    fixture({
      [`/concepts?topicId=${topicId}&page=1&limit=20`]: list([], 2, 0),
    }).client.load('topic', topicId, 1, signal()),
    kind('malformed'),
  );
});
test('external abort differs from bounded timeout and no late payload is adopted', async () => {
  const waiting: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      );
    });
  const timeoutClient = createConceptClient(base, waiting, 5);
  await assert.rejects(
    timeoutClient.load('topic', topicId, 1, signal()),
    kind('network'),
  );
  const abort = new AbortController();
  const client = createConceptClient(base, waiting, 1000);
  const pending = client.load('topic', topicId, 1, abort.signal);
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  let calls = 0;
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    createConceptClient(base, async () => {
      calls++;
      return Response.json({});
    }).load('topic', topicId, 1, cancelled.signal),
    { name: 'AbortError' },
  );
  assert.equal(calls, 0);
});
