import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import {
  topicQuery,
  topicDetailRequest,
} from '../src/modules/topics/topic.schema.js';
import { topicDto } from '../src/modules/topics/topic.dto.js';
import { topicRepository } from '../src/modules/topics/topic.repository.js';
import { createTopicService } from '../src/modules/topics/topic.service.js';
const moduleId = new Types.ObjectId();
const raw = {
  _id: new Types.ObjectId(),
  moduleId,
  learningPathId: new Types.ObjectId(),
  technologyId: new Types.ObjectId(),
  title: 'Synthetic',
  slug: 'synthetic',
  order: 0,
};
const query = {
  moduleId: moduleId.toHexString(),
  page: 2,
  limit: 20,
};
test('topic query validates strict IDs, pagination and safe offsets', () => {
  assert.deepEqual(topicQuery.parse({ moduleId: query.moduleId }), {
    ...query,
    page: 1,
  });
  for (const [patch, field, code] of [
    [{ moduleId: undefined }, 'moduleId', 'invalid_type'],
    [{ moduleId: 'invalid' }, 'moduleId', 'invalid_format'],
    [{ moduleId: query.moduleId + '\n' }, 'moduleId', 'invalid_format'],
    [{ moduleId: [query.moduleId] }, 'moduleId', 'invalid_type'],
    [{ moduleId: { x: query.moduleId } }, 'moduleId', 'invalid_type'],
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
    const result = topicQuery.safeParse(
      Object.assign({ moduleId: query.moduleId }, patch),
    );
    assert.equal(result.success, false);
    if (result.success) assert.fail('Invalid query unexpectedly accepted');
    assert.deepEqual(
      result.error.issues.map(({ path, code }) => ({ path, code })),
      [{ path: [field], code }],
    );
  }
  assert(
    topicDetailRequest.safeParse({
      params: { id: raw._id.toHexString() },
      query: {},
    }).success,
  );
  const detail = topicDetailRequest.safeParse({
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
test('topic query rejects ancestor IDs and status as unknown parameters', () => {
  for (const patch of [
    { technologyId: raw.technologyId.toHexString() },
    { status: 'DRAFT' },
    { learningPathId: raw.learningPathId.toHexString() },
  ]) {
    const result = topicQuery.safeParse({
      moduleId: query.moduleId,
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

test('topic DTO excludes all internal fields and normalizes optional values', () => {
  assert.deepEqual(
    topicDto({
      ...raw,
      ...{
        status: 'PUBLISHED',
        createdBy: new Types.ObjectId(),
        updatedBy: new Types.ObjectId(),
        __v: 2,
        createdAt: new Date(),
      },
    }),
    {
      id: raw._id.toHexString(),
      moduleId: query.moduleId,
      learningPathId: raw.learningPathId.toHexString(),
      technologyId: raw.technologyId.toHexString(),
      title: raw.title,
      slug: raw.slug,
      order: 0,
      description: null,
    },
  );
});
test('topic service preserves empty pagination and generic missing-resource errors', async () => {
  const service = createTopicService({
    async list() {
      return { items: [], total: 21 };
    },
    async detail() {
      return topicDto(raw);
    },
  });
  assert.deepEqual(await service.list(query), {
    items: [],
    pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  assert.deepEqual(await service.detail(raw._id.toHexString()), topicDto(raw));
  const empty = createTopicService({
    async list() {
      return { items: [], total: 0 };
    },
    async detail() {
      return null;
    },
  });
  assert.equal((await empty.list(query)).pagination.totalPages, 0);
  await assert.rejects(
    empty.detail(query.moduleId),
    (e: unknown) =>
      e instanceof AppError &&
      e.statusCode === 404 &&
      e.code === 'TOPIC_NOT_FOUND',
  );
  const missing = createTopicService({
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
      e.code === 'MODULE_NOT_FOUND',
  );
});

const projection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  moduleId: 1,
  title: 1,
  slug: 1,
  description: 1,
  order: 1,
};
const consistency = {
  status: 'PUBLISHED',
  $expr: {
    $and: [
      { $eq: ['$technologyId', '$$technologyId'] },
      { $eq: ['$learningPathId', '$$learningPathId'] },
    ],
  },
};
const ancestors = [
  {
    $lookup: {
      from: 'learningPaths',
      localField: 'learningPathId',
      foreignField: '_id',
      let: { technologyId: '$technologyId' },
      pipeline: [
        {
          $match: {
            status: 'PUBLISHED',
            $expr: { $eq: ['$technologyId', '$$technologyId'] },
          },
        },
        { $project: { _id: 1 } },
      ],
      as: 'path',
    },
  },
  { $match: { 'path.0': { $exists: true } } },
  {
    $lookup: {
      from: 'technologies',
      localField: 'technologyId',
      foreignField: '_id',
      pipeline: [{ $match: { status: 'PUBLISHED' } }, { $project: { _id: 1 } }],
      as: 'technology',
    },
  },
  { $match: { 'technology.0': { $exists: true } } },
];
test('topic list validates the parent chain and filters consistency before a shared items/count facet offline', async (t) => {
  const aggregate = Module.aggregate();
  let mode: 'page' | 'empty' | 'missing' = 'page';
  t.mock.method(aggregate, 'exec', async () =>
    mode === 'missing'
      ? []
      : [
          {
            topics: [
              {
                items: mode === 'page' ? [raw] : [],
                count: mode === 'page' ? [{ total: 21 }] : [],
              },
            ],
          },
        ],
  );
  t.mock.method(Module, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: moduleId, status: 'PUBLISHED' } },
      ...ancestors,
      {
        $lookup: {
          from: 'topics',
          localField: '_id',
          foreignField: 'moduleId',
          let: {
            technologyId: '$technologyId',
            learningPathId: '$learningPathId',
          },
          pipeline: [
            { $match: consistency },
            {
              $facet: {
                items: [
                  { $sort: { order: 1, slug: 1 } },
                  { $skip: 20 },
                  { $limit: 20 },
                  { $project: projection },
                ],
                count: [{ $count: 'total' }],
              },
            },
          ],
          as: 'topics',
        },
      },
      { $project: { _id: 0, topics: 1 } },
    ]);
    return aggregate;
  });
  assert.deepEqual(await topicRepository.list(query), {
    items: [topicDto(raw)],
    total: 21,
  });
  mode = 'empty';
  assert.deepEqual(await topicRepository.list(query), { items: [], total: 0 });
  mode = 'missing';
  assert.equal(await topicRepository.list(query), null);
});
test('topic detail checks all four publication levels and every denormalized reference offline', async (t) => {
  const aggregate = Topic.aggregate();
  t.mock.method(Topic, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: raw._id, status: 'PUBLISHED' } },
      {
        $lookup: {
          from: 'modules',
          localField: 'moduleId',
          foreignField: '_id',
          let: {
            technologyId: '$technologyId',
            learningPathId: '$learningPathId',
          },
          pipeline: [{ $match: consistency }, { $project: { _id: 1 } }],
          as: 'parent',
        },
      },
      { $match: { 'parent.0': { $exists: true } } },
      ...ancestors,
      { $project: projection },
    ]);
    return aggregate;
  });
  t.mock.method(aggregate, 'exec', async () => [raw]);
  assert.deepEqual(
    await topicRepository.detail(raw._id.toHexString()),
    topicDto(raw),
  );
  t.mock.method(aggregate, 'exec', async () => []);
  assert.equal(await topicRepository.detail(raw._id.toHexString()), null);
});
test('topic repository sanitizes failures for both reads', async (t) => {
  for (const model of [Module, Topic]) {
    const aggregate = model.aggregate();
    t.mock.method(aggregate, 'exec', async () => {
      throw new Error('PRIVATE_DRIVER_SENTINEL');
    });
    t.mock.method(model, 'aggregate', () => aggregate);
  }
  for (const read of [
    () => topicRepository.list(query),
    () => topicRepository.detail(raw._id.toHexString()),
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
test('topic detail invalid IDs report the exact params path independently', () => {
  for (const [id, code] of [
    [undefined, 'invalid_type'],
    ['bad', 'invalid_format'],
    [raw._id.toHexString() + '\n', 'invalid_format'],
  ] as const) {
    const result = topicDetailRequest.safeParse({ params: { id }, query: {} });
    assert(!result.success);
    assert.deepEqual(
      result.error.issues.map(({ path, code }) => ({ path, code })),
      [{ path: ['params', 'id'], code }],
    );
  }
});

test('unsafe page integer reports numeric bounds and offset issues precisely', () => {
  const result = topicQuery.safeParse({
    moduleId: query.moduleId,
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
