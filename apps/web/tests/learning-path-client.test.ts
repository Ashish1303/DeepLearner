import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createLearningPathClient,
  LearningError,
} from '../src/lib/api/learning-path-client';
import { pathSchema, listEnvelope } from '../src/lib/learning-paths/contracts';
const tech = 'a'.repeat(24),
  pathId = 'b'.repeat(24),
  moduleId = 'c'.repeat(24),
  topicId = 'd'.repeat(24);
const path = {
  id: pathId,
  technologyId: tech,
  title: 'Path',
  slug: 'path',
  description: null,
  targetLevel: null,
  completionScore: 70,
  order: 0,
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
  meta: { requestId: 'test' },
});
const list = (data: unknown[], page = 1, total = data.length) => ({
  ...detail(data),
  meta: {
    requestId: 'test',
    page,
    limit: 20,
    total,
    totalPages: Math.ceil(total / 20),
  },
});
const base = 'http://localhost:4000/api/v1';
const signal = () => new AbortController().signal;

test('pagination preserves server order, permits empty later pages and uses only the requested page', async () => {
  const rows = [
    { ...path, id: moduleId, title: 'Z first', order: 0 },
    { ...path, id: topicId, title: 'A second', order: 1 },
  ];
  const first = await fixture({
    ['/learning-paths?technologyId=' + tech + '&page=1&limit=20']: list(rows),
  }).client.load('technology', tech, 1, signal());
  assert.deepEqual(
    first.items.map((item) => item.title),
    ['Z first', 'A second'],
  );
  const { client, calls } = fixture({
    ['/learning-paths?technologyId=' + tech + '&page=2&limit=20']: list(
      [],
      2,
      1,
    ),
  });
  const later = await client.load('technology', tech, 2, signal());
  assert.deepEqual(later.items, []);
  assert.equal(later.totalPages, 1);
  assert.deepEqual(calls, [
    '/learning-paths?technologyId=' + tech + '&page=2&limit=20',
  ]);
});
const kind = (name: LearningError['kind']) => (error: unknown) =>
  error instanceof LearningError && error.kind === name;
function fixture(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const records: Record<string, unknown> = {
    ['/learning-paths?technologyId=' + tech + '&page=1&limit=20']: list([path]),
    ['/learning-paths/' + pathId]: detail(path),
    ['/modules?learningPathId=' + pathId + '&page=1&limit=20']: list([
      moduleRecord,
    ]),
    ['/modules/' + moduleId]: detail(moduleRecord),
    ['/topics?moduleId=' + moduleId + '&page=1&limit=20']: list([topic]),
    ['/topics/' + topicId]: detail(topic),
    ...overrides,
  };
  const client = createLearningPathClient(base, async (url, options) => {
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.headers, undefined);
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.method, 'GET');
    const route = String(url).slice(base.length);
    calls.push(route);
    assert(Object.hasOwn(records, route));
    return Response.json(records[route]);
  });
  return { client, calls };
}
test('all four public flows use credential-free requests and verified ancestor breadcrumbs', async () => {
  const { client, calls } = fixture();
  assert.equal(
    (await client.load('technology', tech, 1, signal())).items[0]?.id,
    pathId,
  );
  assert.equal(
    (await client.load('path', pathId, 1, signal())).items[0]?.id,
    moduleId,
  );
  assert.equal(
    (await client.load('module', moduleId, 1, signal())).items[0]?.id,
    topicId,
  );
  const result = await client.load('topic', topicId, 1, signal());
  assert.equal(result.title, 'Topic');
  assert.deepEqual(result.items, []);
  assert.deepEqual(
    result.crumbs.map((crumb) => crumb.title),
    ['Explore technologies', 'Learning paths', 'Path', 'Module'],
  );
  assert.equal(calls.length, 9);
});
test('DTO bounds, IDs and full envelopes reject malformed data and strip hidden fields', () => {
  assert.equal(
    Object.hasOwn(
      pathSchema.parse({
        ...path,
        createdBy: tech,
        status: 'PUBLISHED',
        __v: 1,
      }),
      'createdBy',
    ),
    false,
  );
  for (const change of [
    { id: pathId + '\n' },
    { title: ' ' },
    { slug: 'bad\n' },
    { completionScore: 101 },
    { order: Number.MAX_SAFE_INTEGER + 1 },
    { targetLevel: 'OTHER' },
    { description: 'a'.repeat(2001) },
  ]) {
    assert.equal(pathSchema.safeParse({ ...path, ...change }).success, false);
  }
  for (const raw of [
    list([path, path]),
    {
      ...list([path]),
      meta: { requestId: 'x', page: 1, limit: 21, total: 1, totalPages: 1 },
    },
    list([path], 2, 1),
    { ...list([path]), success: false },
  ]) {
    assert.equal(listEnvelope(pathSchema).safeParse(raw).success, false);
  }
  assert(listEnvelope(pathSchema).safeParse(list([], 3, 1)).success);
});
test('request ID validation fails independently of valid pagination', () => {
  const valid = list([path]);
  const schema = listEnvelope(pathSchema);
  assert(schema.safeParse(valid).success);
  for (const [requestId, code] of [
    ['', 'too_small'],
    [' ', 'custom'],
  ] as const) {
    const result = schema.safeParse({
      ...valid,
      meta: { ...valid.meta, requestId },
    });
    assert(!result.success);
    assert(result.error.issues.length > 0);
    for (const issue of result.error.issues)
      assert.deepEqual(issue.path, ['meta', 'requestId']);
    assert(result.error.issues.some((issue) => issue.code === code));
    assert(
      schema.safeParse({ ...valid, meta: { ...valid.meta, requestId: 'test' } })
        .success,
    );
  }
});
test('totalPages consistency fails independently of a valid request ID', () => {
  const valid = list([path]);
  const schema = listEnvelope(pathSchema);
  assert(schema.safeParse(valid).success);
  const result = schema.safeParse({
    ...valid,
    meta: { ...valid.meta, totalPages: 2 },
  });
  assert(!result.success);
  assert.deepEqual(
    result.error.issues.map(({ path, code }) => ({ path, code })),
    [{ path: ['meta'], code: 'custom' }],
  );
});
test('invalid IDs/pages fail before any fetch and detail IDs must match', async () => {
  const { client, calls } = fixture();
  for (const id of [pathId + '\n', '../escape', ''])
    await assert.rejects(client.load('path', id, 1, signal()), kind('invalid'));
  for (const page of [0, 1.5, Number.MAX_SAFE_INTEGER])
    await assert.rejects(
      client.load('path', pathId, page, signal()),
      kind('invalid'),
    );
  assert.equal(calls.length, 0);
  await assert.rejects(
    fixture({
      ['/learning-paths/' + pathId]: detail({ ...path, id: tech }),
    }).client.load('path', pathId, 1, signal()),
    kind('malformed'),
  );
});
test('list requested page and all hierarchy relationships are independently checked', async () => {
  const cases = [
    [
      'technology',
      tech,
      '/learning-paths?technologyId=' + tech + '&page=1&limit=20',
      list([{ ...path, technologyId: moduleId }]),
    ],
    [
      'technology',
      tech,
      '/learning-paths?technologyId=' + tech + '&page=1&limit=20',
      list([], 2, 1),
    ],
    [
      'path',
      pathId,
      '/modules?learningPathId=' + pathId + '&page=1&limit=20',
      list([{ ...moduleRecord, learningPathId: tech }]),
    ],
    [
      'path',
      pathId,
      '/modules?learningPathId=' + pathId + '&page=1&limit=20',
      list([{ ...moduleRecord, technologyId: moduleId }]),
    ],
    [
      'module',
      moduleId,
      '/modules/' + moduleId,
      detail({ ...moduleRecord, technologyId: moduleId }),
    ],
    ...['moduleId', 'learningPathId', 'technologyId'].map((field) => [
      'module',
      moduleId,
      '/topics?moduleId=' + moduleId + '&page=1&limit=20',
      list([{ ...topic, [field]: topicId }]),
    ]),
    ...['learningPathId', 'technologyId'].map((field) => [
      'topic',
      topicId,
      '/topics/' + topicId,
      detail({ ...topic, [field]: topicId }),
    ]),
  ] as const;
  for (const [resource, id, route, raw] of cases) {
    await assert.rejects(
      fixture({ [route as string]: raw }).client.load(
        resource as 'technology' | 'path' | 'module' | 'topic',
        id as string,
        1,
        signal(),
      ),
      kind('malformed'),
    );
  }
});
test('HTTP errors are sanitized and never request authentication endpoints', async () => {
  for (const [status, expected] of [
    [400, 'invalid'],
    [401, 'failed'],
    [403, 'forbidden'],
    [404, 'missing'],
    [429, 'limited'],
    [503, 'unavailable'],
  ] as const) {
    let count = 0;
    const client = createLearningPathClient(base, async () => {
      count++;
      return Response.json(
        {
          success: false,
          error: { code: 'ERROR', message: 'private sentinel' },
          meta: { requestId: 'test' },
        },
        { status },
      );
    });
    await assert.rejects(
      client.load('technology', tech, 1, signal()),
      (error) =>
        kind(expected)(error) && !(error as Error).message.includes('sentinel'),
    );
    assert.equal(count, 1);
  }
  await assert.rejects(
    createLearningPathClient(base, async () =>
      Response.json({ bad: true }),
    ).load('technology', tech, 1, signal()),
    kind('malformed'),
  );
  await assert.rejects(
    createLearningPathClient(base, async () =>
      Response.json({}, { status: 503 }),
    ).load('technology', tech, 1, signal()),
    kind('malformed'),
  );
});
test('network, bounded timeout and external cancellation stay distinct and do not retry', async () => {
  await assert.rejects(
    createLearningPathClient(base, async () => {
      throw Error('private');
    }).load('technology', tech, 1, signal()),
    kind('network'),
  );
  const waiting: typeof fetch = async (_url, options) =>
    new Promise((_resolve, reject) => {
      options?.signal?.addEventListener(
        'abort',
        () => reject(new Error('aborted')),
        { once: true },
      );
    });
  await assert.rejects(
    createLearningPathClient(base, waiting, 5).load(
      'technology',
      tech,
      1,
      signal(),
    ),
    kind('network'),
  );
  const abort = new AbortController();
  const pending = createLearningPathClient(base, waiting).load(
    'technology',
    tech,
    1,
    abort.signal,
  );
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
