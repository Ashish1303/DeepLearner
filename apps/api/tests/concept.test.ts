import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import {
  conceptQuery,
  conceptDetailRequest,
} from '../src/modules/concepts/concept.schema.js';
import {
  conceptSummaryDto,
  conceptDetailDto,
} from '../src/modules/concepts/concept.dto.js';
import { conceptRepository } from '../src/modules/concepts/concept.repository.js';
import { createConceptService } from '../src/modules/concepts/concept.service.js';
const raw = {
  _id: new Types.ObjectId(),
  topicId: new Types.ObjectId(),
  moduleId: new Types.ObjectId(),
  learningPathId: new Types.ObjectId(),
  technologyId: new Types.ObjectId(),
  title: 'Synthetic',
  slug: 'synthetic',
  difficulty: 'BEGINNER' as const,
  order: 0,
  contentFormat: 'MARKDOWN' as const,
  schemaVersion: 1,
  read: {
    summary: 'Summary',
    bodyMarkdown: '<script>untrusted</script>\n  preserved',
    internal: 'private',
  },
  source: {
    label: 'Synthetic',
    url: 'https://example.invalid/source',
    sourceType: 'OFFICIAL_OR_TRUSTED' as const,
    isOfficial: false,
    internal: 'private',
  },
  status: 'PUBLISHED',
  createdBy: new Types.ObjectId(),
  updatedBy: new Types.ObjectId(),
  __v: 2,
  createdAt: new Date(),
};
const query = { topicId: raw.topicId.toHexString(), page: 2, limit: 20 };

test('revise is detail-only, legacy-null, explicitly projected and independently normalized', () => {
  assert.equal(conceptDetailDto(raw).revise, null);
  const partial = { ...raw, revise: { summary: 'Summary' } };
  assert.deepEqual(conceptDetailDto(partial).revise, {
    summary: 'Summary',
    keyPoints: [],
    memoryTrick: null,
    importantCodeMarkdown: null,
  });
  const revise = {
    summary: '<script>text</script>',
    keyPoints: ['Second', 'First'],
    memoryTrick: 'Remember',
    importantCodeMarkdown: '  # Code\n',
    _id: 'hidden',
    createdBy: 'private',
  };
  const record = { ...raw, revise };
  const dto = conceptDetailDto(record);
  assert.deepEqual(dto.revise, {
    summary: revise.summary,
    keyPoints: ['Second', 'First'],
    memoryTrick: 'Remember',
    importantCodeMarkdown: revise.importantCodeMarkdown,
  });
  assert.notEqual(dto.revise?.keyPoints, revise.keyPoints);
  assert.deepEqual(conceptSummaryDto(record), conceptSummaryDto(raw));
});
test('concept query validates strict IDs, pagination and safe offsets', () => {
  assert.deepEqual(conceptQuery.parse({ topicId: query.topicId }), {
    ...query,
    page: 1,
  });
  for (const [patch, field, code] of [
    [{ topicId: undefined }, 'topicId', 'invalid_type'],
    [{ topicId: 'invalid' }, 'topicId', 'invalid_format'],
    [{ topicId: query.topicId + '\n' }, 'topicId', 'invalid_format'],
    [{ topicId: [query.topicId] }, 'topicId', 'invalid_type'],
    [{ topicId: { x: query.topicId } }, 'topicId', 'invalid_type'],
    [{ limit: ['1', '2'] }, 'limit', 'invalid_type'],
    [{ limit: { x: '1' } }, 'limit', 'invalid_type'],
    [{ limit: '0' }, 'limit', 'invalid_format'],
    [{ page: '0' }, 'page', 'invalid_format'],
    [{ page: '-1' }, 'page', 'invalid_format'],
    [{ page: '1.5' }, 'page', 'invalid_format'],
    [{ page: '1e2' }, 'page', 'invalid_format'],
    [{ page: '1\n' }, 'page', 'invalid_format'],
    [{ limit: '101' }, 'limit', 'too_big'],
    [{ limit: '' }, 'limit', 'invalid_format'],
    [{ page: ['1', '2'] }, 'page', 'invalid_type'],
    [{ page: { x: '1' } }, 'page', 'invalid_type'],
    [{ page: String(Number.MAX_SAFE_INTEGER), limit: '100' }, 'page', 'custom'],
  ] as const) {
    const result = conceptQuery.safeParse(
      Object.assign({ topicId: query.topicId }, patch),
    );
    assert.equal(result.success, false);
    if (result.success) assert.fail('Invalid query unexpectedly accepted');
    assert.deepEqual(
      result.error.issues.map(({ path, code }) => ({ path, code })),
      [{ path: [field], code }],
    );
  }
  assert(
    conceptDetailRequest.safeParse({
      params: { id: raw._id.toHexString() },
      query: {},
    }).success,
  );
  const detail = conceptDetailRequest.safeParse({
    params: { id: raw._id.toHexString() },
    query: { page: '1' },
  });
  assert.equal(detail.success, false);
  if (detail.success) assert.fail('Detail query unexpectedly accepted');
  assert.deepEqual(
    detail.error.issues.map((issue) => ({
      path: issue.path,
      code: issue.code,
      keys: issue.code === 'unrecognized_keys' ? issue.keys : [],
    })),
    [{ path: ['query'], code: 'unrecognized_keys', keys: ['page'] }],
  );
});
test('concept query rejects ancestor IDs and status as unknown parameters', () => {
  for (const patch of [
    { technologyId: raw.technologyId.toHexString() },
    { status: 'DRAFT' },
    { moduleId: raw.moduleId.toHexString() },
    { difficulty: 'BEGINNER' },
    { search: 'x' },
    { sort: 'slug' },
    { learningPathId: raw.learningPathId.toHexString() },
  ]) {
    const result = conceptQuery.safeParse({
      topicId: query.topicId,
      ...patch,
    });
    assert.equal(result.success, false);
    if (result.success)
      assert.fail('Unknown query parameter unexpectedly accepted');
    assert.deepEqual(
      result.error.issues.map((issue) => ({
        path: issue.path,
        code: issue.code,
        keys: issue.code === 'unrecognized_keys' ? issue.keys : [],
      })),
      [{ path: [], code: 'unrecognized_keys', keys: Object.keys(patch) }],
    );
  }
});

test('concept DTOs separate summary and detail and explicitly exclude nested/internal fields', () => {
  const identity = {
    id: raw._id.toHexString(),
    topicId: query.topicId,
    moduleId: raw.moduleId.toHexString(),
    learningPathId: raw.learningPathId.toHexString(),
    technologyId: raw.technologyId.toHexString(),
    title: raw.title,
    slug: raw.slug,
    difficulty: raw.difficulty,
    order: 0,
  };
  assert.deepEqual(conceptSummaryDto(raw), {
    ...identity,
    summary: raw.read.summary,
  });
  assert.deepEqual(conceptDetailDto(raw), {
    ...identity,
    examples: [],
    revise: null,
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: { summary: raw.read.summary, bodyMarkdown: raw.read.bodyMarkdown },
    source: {
      label: raw.source.label,
      url: raw.source.url,
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
  });
});
test('concept service preserves empty/later pagination and generic 404s', async () => {
  const service = createConceptService({
    async list() {
      return { items: [], total: 21 };
    },
    async detail() {
      return conceptDetailDto(raw);
    },
  });
  assert.deepEqual(await service.list(query), {
    items: [],
    pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  assert.deepEqual(
    await service.detail(raw._id.toHexString()),
    conceptDetailDto(raw),
  );
  const empty = createConceptService({
    async list() {
      return { items: [], total: 0 };
    },
    async detail() {
      return null;
    },
  });
  assert.equal((await empty.list(query)).pagination.totalPages, 0);
  await assert.rejects(
    empty.detail(query.topicId),
    (e: unknown) =>
      e instanceof AppError &&
      e.statusCode === 404 &&
      e.code === 'CONCEPT_NOT_FOUND',
  );
  const missing = createConceptService({
    async list() {
      return null;
    },
    async detail() {
      return null;
    },
  });
  await assert.rejects(
    missing.list(query),
    (e: unknown) =>
      e instanceof AppError &&
      e.statusCode === 404 &&
      e.code === 'TOPIC_NOT_FOUND',
  );
});
const identityProjection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  moduleId: 1,
  topicId: 1,
  title: 1,
  slug: 1,
  difficulty: 1,
  order: 1,
};
// Expected contract predicates, independent from repository helpers.
function ancestor(from: string, field: string, refs: string[], as: string) {
  return [
    {
      $lookup: {
        from,
        localField: field,
        foreignField: '_id',
        let: Object.fromEntries(refs.map((r) => [r, '$' + r])),
        pipeline: [
          {
            $match: {
              status: 'PUBLISHED',
              ...(refs.length
                ? {
                    $expr: {
                      $and: refs.map((r) => ({ $eq: ['$' + r, '$$' + r] })),
                    },
                  }
                : {}),
            },
          },
          { $project: { _id: 1 } },
        ],
        as,
      },
    },
    { $match: { [as + '.0']: { $exists: true } } },
  ];
}
const ancestors = [
  ...ancestor(
    'modules',
    'moduleId',
    ['technologyId', 'learningPathId'],
    'module',
  ),
  ...ancestor('learningPaths', 'learningPathId', ['technologyId'], 'path'),
  ...ancestor('technologies', 'technologyId', [], 'technology'),
];
test('concept list checks all ancestors and uses the same consistency input for items and count', async (t) => {
  const aggregate = Topic.aggregate();
  let mode: 'page' | 'empty' | 'missing' = 'page';
  t.mock.method(aggregate, 'exec', async () =>
    mode === 'missing'
      ? []
      : [
          {
            concepts: [
              {
                items: mode === 'page' ? [raw] : [],
                count: mode === 'page' ? [{ total: 21 }] : [],
              },
            ],
          },
        ],
  );
  t.mock.method(Topic, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: raw.topicId, status: 'PUBLISHED' } },
      ...ancestors,
      {
        $lookup: {
          from: 'concepts',
          localField: '_id',
          foreignField: 'topicId',
          let: {
            technologyId: '$technologyId',
            learningPathId: '$learningPathId',
            moduleId: '$moduleId',
          },
          pipeline: [
            {
              $match: {
                status: 'PUBLISHED',
                $expr: {
                  $and: [
                    { $eq: ['$technologyId', '$$technologyId'] },
                    { $eq: ['$learningPathId', '$$learningPathId'] },
                    { $eq: ['$moduleId', '$$moduleId'] },
                  ],
                },
              },
            },
            {
              $facet: {
                items: [
                  { $sort: { order: 1, slug: 1 } },
                  { $skip: 20 },
                  { $limit: 20 },
                  { $project: { ...identityProjection, 'read.summary': 1 } },
                ],
                count: [{ $count: 'total' }],
              },
            },
          ],
          as: 'concepts',
        },
      },
      { $project: { _id: 0, concepts: 1 } },
    ]);
    return aggregate;
  });
  assert.deepEqual(await conceptRepository.list(query), {
    items: [conceptSummaryDto(raw)],
    total: 21,
  });
  mode = 'empty';
  assert.deepEqual(await conceptRepository.list(query), {
    items: [],
    total: 0,
  });
  mode = 'missing';
  assert.equal(await conceptRepository.list(query), null);
});
test('concept detail checks five publication levels, every denormalized reference and safe projection', async (t) => {
  const aggregate = Concept.aggregate();
  t.mock.method(Concept, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: raw._id, status: 'PUBLISHED' } },
      ...ancestor(
        'topics',
        'topicId',
        ['technologyId', 'learningPathId', 'moduleId'],
        'topic',
      ),
      ...ancestors,
      {
        $project: {
          ...identityProjection,
          contentFormat: 1,
          schemaVersion: 1,
          'read.summary': 1,
          'read.bodyMarkdown': 1,
          'source.label': 1,
          'source.url': 1,
          'source.sourceType': 1,
          'source.isOfficial': 1,
          'examples.title': 1,
          'examples.bodyMarkdown': 1,
          'revise.summary': 1,
          'revise.keyPoints': 1,
          'revise.memoryTrick': 1,
          'revise.importantCodeMarkdown': 1,
        },
      },
    ]);
    return aggregate;
  });
  t.mock.method(aggregate, 'exec', async () => [raw]);
  assert.deepEqual(
    await conceptRepository.detail(raw._id.toHexString()),
    conceptDetailDto(raw),
  );
  t.mock.method(aggregate, 'exec', async () => []);
  assert.equal(await conceptRepository.detail(raw._id.toHexString()), null);
});
test('concept dependency failures are sanitized on both paths', async (t) => {
  for (const model of [Topic, Concept]) {
    const agg = model.aggregate();
    t.mock.method(agg, 'exec', async () => {
      throw new Error('PRIVATE_DRIVER_SENTINEL');
    });
    t.mock.method(model, 'aggregate', () => agg);
  }
  for (const read of [
    () => conceptRepository.list(query),
    () => conceptRepository.detail(raw._id.toHexString()),
  ])
    await assert.rejects(
      read(),
      (e: unknown) =>
        e instanceof AppError &&
        e.statusCode === 503 &&
        e.code === 'DEPENDENCY_UNAVAILABLE' &&
        !e.message.includes('PRIVATE_DRIVER_SENTINEL'),
    );
});
test('concept detail invalid IDs report the exact params path independently', () => {
  for (const [id, code] of [
    [undefined, 'invalid_type'],
    ['bad', 'invalid_format'],
    [raw._id.toHexString() + '\n', 'invalid_format'],
  ] as const) {
    const result = conceptDetailRequest.safeParse({
      params: { id },
      query: {},
    });
    assert(!result.success);
    assert.deepEqual(
      result.error.issues.map(({ path, code }) => ({ path, code })),
      [{ path: ['params', 'id'], code }],
    );
  }
});

test('unsafe page integer reports numeric bounds and offset issues precisely', () => {
  const result = conceptQuery.safeParse({
    topicId: query.topicId,
    page: '9007199254740992',
  });
  assert(!result.success);
  assert.deepEqual(
    result.error.issues.map(({ path, code }) => ({ path, code })),
    [
      { path: ['page'], code: 'too_big' },
      { path: ['page'], code: 'too_big' },
      { path: ['page'], code: 'custom' },
    ],
  );
});

test('examples appear only in detail, ordered and explicitly projected without nested metadata', () => {
  const examples = [
    {
      title: 'Second authored first',
      bodyMarkdown: '# Two',
      _id: 'hidden',
      status: 'DRAFT',
    },
    { title: 'First authored second', bodyMarkdown: '# One' },
  ];
  const record = { ...raw, examples };
  assert.deepEqual(
    conceptDetailDto(record).examples,
    examples.map(({ title, bodyMarkdown }) => ({ title, bodyMarkdown })),
  );
  assert.deepEqual(conceptSummaryDto(record), conceptSummaryDto(raw));
  assert.deepEqual(conceptDetailDto(raw).examples, []);
});
