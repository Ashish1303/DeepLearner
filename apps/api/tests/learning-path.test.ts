import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import {
  learningPathQuery,
  learningPathDetailRequest,
} from '../src/modules/learning-paths/learning-path.schema.js';
import { learningPathDto } from '../src/modules/learning-paths/learning-path.dto.js';
import { learningPathRepository } from '../src/modules/learning-paths/learning-path.repository.js';
import { createLearningPathService } from '../src/modules/learning-paths/learning-path.service.js';
const technologyId = new Types.ObjectId();
const raw = {
  _id: new Types.ObjectId(),
  technologyId,
  title: 'Synthetic',
  slug: 'synthetic',
  completionScore: 70,
  order: 0,
};
const query = { technologyId: technologyId.toHexString(), page: 2, limit: 20 };
test('learning path query validates strict IDs, pagination and safe offsets', () => {
  assert.deepEqual(
    learningPathQuery.parse({ technologyId: query.technologyId }),
    { ...query, page: 1 },
  );
  for (const patch of [
    { technologyId: undefined },
    { technologyId: 'invalid' },
    { technologyId: query.technologyId + '\n' },
    { technologyId: [query.technologyId] },
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1e2' },
    { page: '1\n' },
    { limit: '101' },
    { limit: '' },
    { page: ['1', '2'] },
    { page: { x: '1' } },
    { status: 'DRAFT' },
    { page: String(Number.MAX_SAFE_INTEGER), limit: '100' },
  ]) {
    assert.equal(
      learningPathQuery.safeParse({
        technologyId: query.technologyId,
        ...patch,
      }).success,
      false,
    );
  }
  assert(
    learningPathDetailRequest.safeParse({
      params: { id: raw._id.toHexString() },
      query: {},
    }).success,
  );
  assert(
    !learningPathDetailRequest.safeParse({
      params: { id: raw._id.toHexString() },
      query: { page: '1' },
    }).success,
  );
});
test('learning path DTO excludes all internal fields and normalizes optional values', () => {
  assert.deepEqual(
    learningPathDto({
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
      technologyId: query.technologyId,
      title: raw.title,
      slug: raw.slug,
      completionScore: 70,
      order: 0,
      description: null,
      targetLevel: null,
    },
  );
});
test('learning path service preserves empty pagination and generic missing-resource errors', async () => {
  const service = createLearningPathService({
    async list() {
      return { items: [], total: 21 };
    },
    async detail() {
      return learningPathDto(raw);
    },
  });
  assert.deepEqual(await service.list(query), {
    items: [],
    pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  assert.deepEqual(
    await service.detail(raw._id.toHexString()),
    learningPathDto(raw),
  );
  const empty = createLearningPathService({
    async list() {
      return { items: [], total: 0 };
    },
    async detail() {
      return null;
    },
  });
  assert.equal((await empty.list(query)).pagination.totalPages, 0);
  await assert.rejects(
    empty.detail(query.technologyId),
    (e: unknown) =>
      e instanceof AppError &&
      e.statusCode === 404 &&
      e.code === 'LEARNING_PATH_NOT_FOUND',
  );
  const missing = createLearningPathService({
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
      e.code === 'TECHNOLOGY_NOT_FOUND',
  );
});
test('list aggregation constrains published parent/children and shares count visibility offline', async (t) => {
  const aggregate = Technology.aggregate();
  let mode: 'page' | 'empty' | 'missing' = 'page';
  t.mock.method(aggregate, 'exec', async () =>
    mode === 'missing'
      ? []
      : [
          {
            paths: [
              {
                items: mode === 'page' ? [raw] : [],
                count: mode === 'page' ? [{ total: 21 }] : [],
              },
            ],
          },
        ],
  );
  const projection = {
    _id: 1,
    technologyId: 1,
    title: 1,
    slug: 1,
    description: 1,
    targetLevel: 1,
    completionScore: 1,
    order: 1,
  };
  t.mock.method(Technology, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: technologyId, status: 'PUBLISHED' } },
      {
        $lookup: {
          from: 'learningPaths',
          localField: '_id',
          foreignField: 'technologyId',
          pipeline: [
            { $match: { status: 'PUBLISHED' } },
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
          as: 'paths',
        },
      },
      { $project: { _id: 0, paths: 1 } },
    ]);
    return aggregate;
  });
  assert.deepEqual(await learningPathRepository.list(query), {
    items: [learningPathDto(raw)],
    total: 21,
  });
  mode = 'empty';
  assert.deepEqual(await learningPathRepository.list(query), {
    items: [],
    total: 0,
  });
  mode = 'missing';
  assert.equal(await learningPathRepository.list(query), null);
});
test('detail aggregation excludes unpublished/orphan paths and projects metadata only offline', async (t) => {
  const aggregate = LearningPath.aggregate();
  t.mock.method(LearningPath, 'aggregate', (pipeline: unknown) => {
    assert.deepEqual(pipeline, [
      { $match: { _id: raw._id, status: 'PUBLISHED' } },
      {
        $lookup: {
          from: 'technologies',
          localField: 'technologyId',
          foreignField: '_id',
          pipeline: [
            { $match: { status: 'PUBLISHED' } },
            { $project: { _id: 1 } },
          ],
          as: 'parent',
        },
      },
      { $match: { 'parent.0': { $exists: true } } },
      {
        $project: {
          _id: 1,
          technologyId: 1,
          title: 1,
          slug: 1,
          description: 1,
          targetLevel: 1,
          completionScore: 1,
          order: 1,
        },
      },
    ]);
    return aggregate;
  });
  t.mock.method(aggregate, 'exec', async () => [raw]);
  assert.deepEqual(
    await learningPathRepository.detail(raw._id.toHexString()),
    learningPathDto(raw),
  );
  t.mock.method(aggregate, 'exec', async () => []);
  assert.equal(
    await learningPathRepository.detail(raw._id.toHexString()),
    null,
  );
});
test('both repository reads sanitize driver failures', async (t) => {
  for (const model of [Technology, LearningPath]) {
    const aggregate = model.aggregate();
    t.mock.method(aggregate, 'exec', async () => {
      throw new Error('PRIVATE_DRIVER_SENTINEL');
    });
    t.mock.method(model, 'aggregate', () => aggregate);
  }
  for (const read of [
    () => learningPathRepository.list(query),
    () => learningPathRepository.detail(raw._id.toHexString()),
  ]) {
    await assert.rejects(
      read(),
      (e: unknown) =>
        e instanceof AppError &&
        e.statusCode === 503 &&
        e.code === 'DEPENDENCY_UNAVAILABLE' &&
        !e.message.includes('PRIVATE_DRIVER_SENTINEL'),
    );
  }
});
