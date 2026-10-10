// Outside *.test.ts. Do not execute without separately approved disposable infrastructure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { learningPathRepository } from '../src/modules/learning-paths/learning-path.repository.js';
import { createLearningPathService } from '../src/modules/learning-paths/learning-path.service.js';
import { AppError } from '../src/common/errors/app-error.js';

test(
  'F017 isolated learning path visibility, indexes and read-only behavior',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F017_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F017_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f017-test',
    );
    assert.equal(process.env.F017_TEST_DB, 'deeplearner-f017-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F017_TEST_URI,
        MONGODB_DB_NAME: process.env.F017_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    let technologiesOwned = false;
    let pathsOwned = false;
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.deepEqual(await db.listCollections().toArray(), []);
      await Technology.createCollection();
      technologiesOwned = true;
      await LearningPath.createCollection();
      pathsOwned = true;
      await Technology.createIndexes();
      await LearningPath.createIndexes();
      // Synthetic reference only; no Admin creation or assertion of real provenance.
      const actor = new Types.ObjectId();
      const parents = await Technology.create(
        (['PUBLISHED', 'PUBLISHED', 'DRAFT', 'ARCHIVED'] as const).map(
          (status, index) => ({
            name: 'Synthetic technology',
            slug: `synthetic-${index}`,
            status,
            createdBy: actor,
            updatedBy: actor,
          }),
        ),
      );
      const first = parents[0]!;
      const second = parents[1]!;
      const path = (
        technologyId: Types.ObjectId,
        slug: string,
        status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' = 'PUBLISHED',
        order = 0,
      ) => ({
        technologyId,
        title: 'Synthetic path',
        slug,
        status,
        order,
        createdBy: actor,
        updatedBy: actor,
      });
      const service = createLearningPathService(learningPathRepository);
      await t.test(
        'real indexes enforce parent-scoped uniqueness including archive and races',
        async () => {
          const indexes = await LearningPath.collection.indexes();
          assert(
            indexes.some(
              (index) =>
                index.unique === true &&
                JSON.stringify(index.key) ===
                  JSON.stringify({ technologyId: 1, slug: 1 }),
            ),
          );
          assert(
            indexes.some(
              (index) =>
                JSON.stringify(index.key) ===
                JSON.stringify({ technologyId: 1, status: 1, order: 1 }),
            ),
          );
          assert(
            !indexes.some((index) => index.expireAfterSeconds !== undefined),
          );
          const duplicate = (error: unknown) =>
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 11000;
          await LearningPath.create(path(first._id, 'reserved', 'ARCHIVED'));
          await assert.rejects(
            LearningPath.create(path(first._id, 'reserved')),
            duplicate,
          );
          await LearningPath.create(path(second._id, 'reserved'));
          const outcomes = await Promise.allSettled([
            LearningPath.create(path(first._id, 'race', 'DRAFT')),
            LearningPath.create(path(first._id, 'race', 'DRAFT')),
          ]);
          assert.equal(
            outcomes.filter((result) => result.status === 'fulfilled').length,
            1,
          );
          const rejected = outcomes.find(
            (result) => result.status === 'rejected',
          );
          assert(rejected?.status === 'rejected' && duplicate(rejected.reason));
          assert.equal(
            await LearningPath.countDocuments({
              technologyId: first._id,
              slug: 'race',
            }),
            1,
          );
        },
      );
      await t.test(
        'published parent/path, ordering, pagination, safe DTOs and non-mutating reads',
        async () => {
          const visible = await LearningPath.create([
            path(first._id, 'beta'),
            path(first._id, 'alpha'),
            path(first._id, 'last', 'PUBLISHED', 1),
          ]);
          const hidden = await LearningPath.create([
            path(first._id, 'draft', 'DRAFT'),
            path(first._id, 'archived', 'ARCHIVED'),
            path(parents[2]!._id, 'hidden'),
            path(parents[3]!._id, 'hidden'),
            path(new Types.ObjectId(), 'orphan'),
          ]);
          const beforePaths = await LearningPath.find().sort({ _id: 1 }).lean();
          const beforeParents = await Technology.find().sort({ _id: 1 }).lean();
          const query = {
            technologyId: first._id.toHexString(),
            page: 1,
            limit: 2,
          };
          const result = await service.list(query);
          assert.deepEqual(
            result.items.map((item) => item.slug),
            ['alpha', 'beta'],
          );
          assert.equal(result.pagination.total, 3);
          assert.deepEqual(
            (await service.list({ ...query, page: 2 })).items.map(
              (item) => item.slug,
            ),
            ['last'],
          );
          assert.deepEqual(
            (await service.list({ ...query, page: 3 })).items,
            [],
          );
          const expectedKeys = [
            'id',
            'technologyId',
            'title',
            'slug',
            'description',
            'targetLevel',
            'completionScore',
            'order',
          ].sort();
          for (const record of visible) {
            const dto = await service.detail(record._id.toHexString());
            assert.deepEqual(Object.keys(dto).sort(), expectedKeys);
            assert.equal(dto.description, null);
            assert.equal(dto.targetLevel, null);
            assert.equal(dto.completionScore, 70);
          }
          for (const dto of result.items)
            assert.deepEqual(Object.keys(dto).sort(), expectedKeys);
          for (const record of hidden)
            await assert.rejects(
              service.detail(record._id.toHexString()),
              (e: unknown) =>
                e instanceof AppError &&
                e.code === 'LEARNING_PATH_NOT_FOUND' &&
                e.statusCode === 404,
            );
          for (const technologyId of [
            parents[2]!._id,
            parents[3]!._id,
            new Types.ObjectId(),
          ])
            await assert.rejects(
              service.list({
                ...query,
                technologyId: technologyId.toHexString(),
              }),
              (e: unknown) =>
                e instanceof AppError &&
                e.code === 'TECHNOLOGY_NOT_FOUND' &&
                e.statusCode === 404,
            );
          assert.equal(
            await learningPathRepository.detail(
              new Types.ObjectId().toHexString(),
            ),
            null,
          );
          assert.deepEqual(
            await LearningPath.find().sort({ _id: 1 }).lean(),
            beforePaths,
          );
          assert.deepEqual(
            await Technology.find().sort({ _id: 1 }).lean(),
            beforeParents,
          );
        },
      );
      await t.test(
        'published parent with no paths returns an empty page rather than 404',
        async () => {
          const parent = await Technology.create({
            name: 'Empty synthetic',
            slug: 'empty-synthetic',
            status: 'PUBLISHED',
            createdBy: actor,
            updatedBy: actor,
          });
          assert.deepEqual(
            await service.list({
              technologyId: parent._id.toHexString(),
              page: 1,
              limit: 20,
            }),
            {
              items: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            },
          );
        },
      );
    } finally {
      try {
        try {
          if (pathsOwned) await LearningPath.collection.drop();
        } finally {
          if (technologiesOwned) await Technology.collection.drop();
        }
      } finally {
        await database.disconnect();
      }
    }
  },
);
