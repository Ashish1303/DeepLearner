// Not part of *.test.ts. Execution requires separately approved disposable infrastructure.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { technologyRepository } from '../src/modules/technologies/technology.repository.js';

test(
  'F015 isolated catalog indexes, visibility and safe reads',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F015_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F015_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f015-test',
    );
    assert.equal(process.env.F015_TEST_DB, 'deeplearner-f015-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F015_TEST_URI,
        MONGODB_DB_NAME: process.env.F015_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    let owned = false;
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.deepEqual(await db.listCollections().toArray(), []);
      await Technology.createCollection();
      owned = true;
      await Technology.createIndexes();
      // Synthetic reference values only, not real provisioning or a claim of Admin existence.
      const actor = new Types.ObjectId();
      const fixture = (
        slug: string,
        status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' = 'PUBLISHED',
        order = 0,
      ) => ({
        name: 'Synthetic technology',
        slug,
        status,
        order,
        createdBy: actor,
        updatedBy: actor,
      });
      await t.test(
        'only published records sorted and paginated; safe DTO/read-only behavior',
        async () => {
          await Technology.insertMany([
            fixture('beta'),
            fixture('alpha'),
            fixture('last', 'PUBLISHED', 1),
            fixture('draft', 'DRAFT'),
            fixture('archived', 'ARCHIVED'),
          ]);
          const before = await Technology.find().sort({ _id: 1 }).lean();
          const first = await technologyRepository.list({ page: 1, limit: 2 });
          assert.equal(first.total, 3);
          assert.deepEqual(
            first.items.map((item) => item.slug),
            ['alpha', 'beta'],
          );
          for (const item of first.items)
            assert.deepEqual(
              Object.keys(item).sort(),
              [
                'id',
                'name',
                'slug',
                'description',
                'iconAssetId',
                'order',
              ].sort(),
            );
          assert.deepEqual(
            (await technologyRepository.list({ page: 2, limit: 2 })).items.map(
              (item) => item.slug,
            ),
            ['last'],
          );
          assert.deepEqual(
            (await technologyRepository.list({ page: 3, limit: 2 })).items,
            [],
          );
          assert.deepEqual(
            await Technology.find().sort({ _id: 1 }).lean(),
            before,
          );
        },
      );
      await t.test(
        'slug uniqueness includes archived records and concurrent inserts',
        async () => {
          await assert.rejects(
            Technology.create(fixture('archived')),
            (error: unknown) =>
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 11000,
          );
          const outcomes = await Promise.allSettled([
            Technology.create(fixture('race')),
            Technology.create(fixture('race')),
          ]);
          assert.equal(
            outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
            1,
          );
          const rejected = outcomes.find(
            (outcome) => outcome.status === 'rejected',
          );
          assert(rejected?.status === 'rejected');
          assert.equal(rejected.reason.code, 11000);
          assert.equal(await Technology.countDocuments({ slug: 'race' }), 1);
          const indexes = await Technology.collection.indexes();
          assert(
            indexes.some(
              (index) => index.unique === true && index.key.slug === 1,
            ),
          );
          assert(
            indexes.some(
              (index) => index.key.status === 1 && index.key.order === 1,
            ),
          );
          assert(
            !indexes.some((index) => index.expireAfterSeconds !== undefined),
          );
        },
      );
    } finally {
      try {
        if (owned) await Technology.collection.drop();
      } finally {
        await database.disconnect();
      }
    }
  },
);
