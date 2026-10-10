import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import {
  moduleQuery,
  moduleDetailRequest,
} from '../src/modules/modules/module.schema.js';
import { moduleDto } from '../src/modules/modules/module.dto.js';
import { moduleRepository } from '../src/modules/modules/module.repository.js';
import { createModuleService } from '../src/modules/modules/module.service.js';
const learningPathId = new Types.ObjectId();
const raw = {
  _id: new Types.ObjectId(),
  learningPathId,
  technologyId: new Types.ObjectId(),
  title: 'Synthetic',
  slug: 'synthetic',
  order: 0,
};
const query = {
  learningPathId: learningPathId.toHexString(),
  page: 2,
  limit: 20,
};
test('module query validates strict IDs, pagination and safe offsets', () => {
  assert.deepEqual(
    moduleQuery.parse({ learningPathId: query.learningPathId }),
    { ...query, page: 1 },
  );
  for (const [patch, field, code] of [
    [{ learningPathId: undefined }, 'learningPathId', 'invalid_type'],
    [{ learningPathId: 'invalid' }, 'learningPathId', 'invalid_format'],
    [
      { learningPathId: query.learningPathId + '\n' },
      'learningPathId',
      'invalid_format',
    ],
    [
      { learningPathId: [query.learningPathId] },
      'learningPathId',
      'invalid_type',
    ],
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
    const result = moduleQuery.safeParse(
      Object.assign({ learningPathId: query.learningPathId }, patch),
    );
    assert.equal(result.success, false);
    if (result.success) assert.fail('Invalid query unexpectedly accepted');
    assert.deepEqual(
      result.error.issues.map(({ path, code }) => ({ path, code })),
      [{ path: [field], code }],
    );
  }
  assert(
    moduleDetailRequest.safeParse({
      params: { id: raw._id.toHexString() },
      query: {},
    }).success,
  );
  const detail = moduleDetailRequest.safeParse({
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
test('module query rejects technologyId and status as unknown parameters', () => {
  for (const patch of [
    { technologyId: raw.technologyId.toHexString() },
    { status: 'DRAFT' },
  ]) {
    const result = moduleQuery.safeParse({
      learningPathId: query.learningPathId,
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

test('module DTO excludes all internal fields and normalizes optional values', () => {
  assert.deepEqual(
    moduleDto({
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
      learningPathId: query.learningPathId,
      technologyId: raw.technologyId.toHexString(),
      title: raw.title,
      slug: raw.slug,
      order: 0,
      description: null,
    },
  );
});
test('module service preserves empty pagination and generic missing-resource errors', async () => {
  const service = createModuleService({
    async list() {
      return { items: [], total: 21 };
    },
    async detail() {
      return moduleDto(raw);
    },
  });
  assert.deepEqual(await service.list(query), {
    items: [],
    pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  assert.deepEqual(await service.detail(raw._id.toHexString()), moduleDto(raw));
  const empty = createModuleService({
    async list() {
      return { items: [], total: 0 };
    },
    async detail() {
      return null;
    },
  });
  assert.equal((await empty.list(query)).pagination.totalPages, 0);
  await assert.rejects(
    empty.detail(query.learningPathId),
    (e: unknown) =>
      e instanceof AppError &&
      e.statusCode === 404 &&
      e.code === 'MODULE_NOT_FOUND',
  );
  const missing = createModuleService({
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
      e.code === 'LEARNING_PATH_NOT_FOUND',
  );
});
const projection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  title: 1,
  slug: 1,
  description: 1,
  order: 1,
};
const technologyStages = [
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
test('list filters all ancestors and mismatched IDs before the shared count/items facet offline', async (t) => {
  const aggregate = LearningPath.aggregate();
  let mode: 'page' | 'empty' | 'missing' = 'page';
  t.mock.method(aggregate, 'exec', async () =>
    mode === 'missing'
      ? []
      : [
          {
            modules: [
              {
                items: mode === 'page' ? [raw] : [],
                count: mode === 'page' ? [{ total: 21 }] : [],
              },
            ],
          },
        ],
  );
  t.mock.method(LearningPath, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: learningPathId, status: 'PUBLISHED' } },
      ...technologyStages,
      {
        $lookup: {
          from: 'modules',
          localField: '_id',
          foreignField: 'learningPathId',
          let: { technologyId: '$technologyId' },
          pipeline: [
            {
              $match: {
                status: 'PUBLISHED',
                $expr: { $eq: ['$technologyId', '$$technologyId'] },
              },
            },
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
          as: 'modules',
        },
      },
      { $project: { _id: 0, modules: 1 } },
    ]);
    return aggregate;
  });
  assert.deepEqual(await moduleRepository.list(query), {
    items: [moduleDto(raw)],
    total: 21,
  });
  mode = 'empty';
  assert.deepEqual(await moduleRepository.list(query), { items: [], total: 0 });
  mode = 'missing';
  assert.equal(await moduleRepository.list(query), null);
});
test('detail excludes hidden, orphaned and inconsistent hierarchy offline', async (t) => {
  const aggregate = Module.aggregate();
  t.mock.method(Module, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: raw._id, status: 'PUBLISHED' } },
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
          as: 'parent',
        },
      },
      { $match: { 'parent.0': { $exists: true } } },
      ...technologyStages,
      { $project: projection },
    ]);
    return aggregate;
  });
  t.mock.method(aggregate, 'exec', async () => [raw]);
  assert.deepEqual(
    await moduleRepository.detail(raw._id.toHexString()),
    moduleDto(raw),
  );
  t.mock.method(aggregate, 'exec', async () => []);
  assert.equal(await moduleRepository.detail(raw._id.toHexString()), null);
});
test('module repository sanitizes both driver failure paths', async (t) => {
  for (const model of [LearningPath, Module]) {
    const aggregate = model.aggregate();
    t.mock.method(aggregate, 'exec', async () => {
      throw new Error('PRIVATE_DRIVER_SENTINEL');
    });
    t.mock.method(model, 'aggregate', () => aggregate);
  }
  for (const read of [
    () => moduleRepository.list(query),
    () => moduleRepository.detail(raw._id.toHexString()),
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
