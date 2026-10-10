// Separately gated: never part of the offline *.test.ts suite.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { topicRepository } from '../src/modules/topics/topic.repository.js';
import { createTopicService } from '../src/modules/topics/topic.service.js';
import { AppError } from '../src/common/errors/app-error.js';

test(
  'F019 isolated topic database and HTTP verification',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F019_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F019_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f019-test',
    );
    assert.equal(process.env.F019_TEST_DB, 'deeplearner-f019-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F019_TEST_URI,
        MONGODB_DB_NAME: process.env.F019_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const owned: ('topics' | 'modules' | 'learningPaths' | 'technologies')[] =
      [];
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.equal(db.databaseName, 'deeplearner-f019-test');
      assert.deepEqual(await db.listCollections().toArray(), []);
      for (const model of [Technology, LearningPath, Module, Topic]) {
        await model.createCollection();
        owned.unshift(model.collection.name as (typeof owned)[number]);
        await model.createIndexes();
      }
      const actor = new Types.ObjectId(); // Synthetic reference only, not an Admin account.
      const technologies = await Technology.create(
        (['PUBLISHED', 'DRAFT', 'ARCHIVED', 'PUBLISHED'] as const).map(
          (status, i) => ({
            name: 'Synthetic',
            slug: 'synthetic-' + i,
            status,
            createdBy: actor,
            updatedBy: actor,
          }),
        ),
      );
      const tech = technologies[0]!;
      const learningPaths = await LearningPath.create(
        [
          { technologyId: tech._id, slug: 'published', status: 'PUBLISHED' },
          { technologyId: tech._id, slug: 'draft', status: 'DRAFT' },
          { technologyId: tech._id, slug: 'archived', status: 'ARCHIVED' },
          {
            technologyId: technologies[1]!._id,
            slug: 'hidden-tech',
            status: 'PUBLISHED',
          },
          {
            technologyId: technologies[2]!._id,
            slug: 'archived-tech',
            status: 'PUBLISHED',
          },
          {
            technologyId: new Types.ObjectId(),
            slug: 'orphan-tech',
            status: 'PUBLISHED',
          },
          { technologyId: tech._id, slug: 'other', status: 'PUBLISHED' },
        ].map((p) => ({
          ...p,
          status: p.status as 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
          title: 'Synthetic path',
          createdBy: actor,
          updatedBy: actor,
        })),
      );
      const parent = (
        slug: string,
        status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' = 'PUBLISHED',
        path = learningPaths[0]!,
      ) => ({
        title: 'Synthetic module',
        slug,
        status,
        learningPathId: path._id,
        technologyId: path.technologyId,
      });
      const paths = await Module.create([
        parent('first'),
        parent('second'),
        parent('draft', 'DRAFT'),
        parent('archived', 'ARCHIVED'),
        ...learningPaths
          .slice(1, 6)
          .map((p, i) => parent('hidden-' + i, 'PUBLISHED', p)),
        { ...parent('orphan-path'), learningPathId: new Types.ObjectId() },
        { ...parent('inconsistent-tech'), technologyId: technologies[3]!._id },
      ]);
      const first = paths[0]!;
      const record = (
        slug: string,
        status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED' = 'PUBLISHED',
        order = 0,
        parent = first,
      ) => ({
        technologyId: parent.technologyId,
        moduleId: parent._id,
        learningPathId: parent.learningPathId,
        title: 'Synthetic topic',
        slug,
        status,
        order,
      });
      const service = createTopicService(topicRepository);
      const query = {
        moduleId: first._id.toHexString(),
        page: 1,
        limit: 2,
      };
      const missing = (error: unknown) =>
        error instanceof AppError && error.statusCode === 404;
      await t.test(
        'real indexes enforce scoped and archived uniqueness including concurrent inserts',
        async () => {
          const indexes = await Topic.collection.indexes();
          assert.equal(indexes.length, 3);
          assert(
            indexes.some(
              (i) =>
                i.unique &&
                JSON.stringify(i.key) ===
                  JSON.stringify({ moduleId: 1, slug: 1 }),
            ),
          );
          assert(
            indexes.some(
              (i) =>
                JSON.stringify(i.key) ===
                JSON.stringify({ moduleId: 1, status: 1, order: 1 }),
            ),
          );
          assert(!indexes.some((i) => i.expireAfterSeconds !== undefined));
          const duplicate = (e: unknown) =>
            typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            e.code === 11000;
          await Topic.create(record('reserved', 'ARCHIVED'));
          await assert.rejects(Topic.create(record('reserved')), duplicate);
          await Topic.create(record('reserved', 'DRAFT', 0, paths[1]!));
          const outcomes = await Promise.allSettled([
            Topic.create(record('race', 'DRAFT')),
            Topic.create(record('race', 'DRAFT')),
          ]);
          assert.equal(
            outcomes.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          const rejected = outcomes.find((r) => r.status === 'rejected');
          assert(rejected?.status === 'rejected' && duplicate(rejected.reason));
        },
      );
      await t.test(
        'four-level visibility and consistency govern both DTOs and pagination',
        async () => {
          const visible = await Topic.create([
            record('beta'),
            record('alpha'),
            record('last', 'PUBLISHED', 1),
          ]);
          const hidden = await Topic.create([
            record('draft', 'DRAFT'),
            record('archived', 'ARCHIVED'),
            ...paths.slice(2).map((p) => record('hidden', 'PUBLISHED', 0, p)),
            { ...record('orphan'), moduleId: new Types.ObjectId() },
            { ...record('wrong-path'), learningPathId: learningPaths[6]!._id },
            { ...record('orphan-path'), learningPathId: new Types.ObjectId() },
            { ...record('mismatch'), technologyId: technologies[1]!._id },
            // Published but wrong Technology must also be excluded.
            {
              ...record('mismatch-published'),
              technologyId: technologies[3]!._id,
            },
          ]);
          const result = await service.list(query);
          assert.deepEqual(
            result.items.map((r) => r.slug),
            ['alpha', 'beta'],
          );
          assert.equal(result.pagination.total, 3);
          assert.equal(result.pagination.totalPages, 2);
          assert.deepEqual(
            (await service.list({ ...query, page: 2 })).items.map(
              (r) => r.slug,
            ),
            ['last'],
          );
          assert.deepEqual(
            (await service.list({ ...query, page: 3 })).items,
            [],
          );
          assert.equal(
            (
              await service.list({
                ...query,
                moduleId: paths[1]!._id.toHexString(),
              })
            ).pagination.total,
            0,
          );
          const keys = [
            'id',
            'technologyId',
            'moduleId',
            'learningPathId',
            'title',
            'slug',
            'description',
            'order',
          ].sort();
          for (const item of result.items)
            assert.deepEqual(Object.keys(item).sort(), keys);
          for (const item of visible) {
            const dto = await service.detail(item._id.toHexString());
            assert.deepEqual(Object.keys(dto).sort(), keys);
            assert.equal(dto.description, null);
          }
          for (const item of hidden)
            await assert.rejects(
              service.detail(item._id.toHexString()),
              missing,
            );
          for (const parent of paths.slice(2))
            await assert.rejects(
              service.list({
                ...query,
                moduleId: parent._id.toHexString(),
              }),
              missing,
            );
          await assert.rejects(
            service.detail(new Types.ObjectId().toHexString()),
            missing,
          );
          await assert.rejects(
            service.list({
              ...query,
              moduleId: new Types.ObjectId().toHexString(),
            }),
            missing,
          );
        },
      );
      await t.test(
        'public HTTP reads, invalid input, generic 404, CORS and shared budget with real repository',
        async () => {
          Object.assign(process.env, {
            APP_ENV: 'LOCAL',
            EMAIL_PROVIDER: 'disabled',
            LOG_LEVEL: 'silent',
            GOOGLE_CLIENT_ID: '',
            MONGODB_URI: process.env.F019_TEST_URI,
            MONGODB_DB_NAME: process.env.F019_TEST_DB,
            ACCESS_TOKEN_SECRET: Buffer.from(
              Array.from({ length: 32 }, (_, i) => i + 1),
            ).toString('base64'),
            ACCESS_TOKEN_ISSUER: 'test',
            ACCESS_TOKEN_AUDIENCE: 'test',
            AUTH_COOKIE_SECURE: 'false',
            CORS_ORIGINS: 'http://127.0.0.1:3000',
          });
          const { createApp } = await import('../src/app.js');
          const before = await Promise.all([
            Technology.find().sort({ _id: 1 }).lean(),
            LearningPath.find().sort({ _id: 1 }).lean(),
            Module.find().sort({ _id: 1 }).lean(),
            Topic.find().sort({ _id: 1 }).lean(),
          ]);
          const server = createApp(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            service,
            { max: 5, windowMs: 900000 },
          ).listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
            const address = server.address();
            assert(address && typeof address !== 'string');
            const url = 'http://127.0.0.1:' + address.port + '/api/v1/topics';
            const list = await fetch(url + '?moduleId=' + query.moduleId, {
              headers: {
                Cookie: 'synthetic=unused',
                Authorization: 'Bearer synthetic-invalid',
                Origin: 'http://127.0.0.1:3000',
              },
            });
            assert.equal(list.status, 200);
            assert.equal(list.headers.get('cache-control'), 'no-store');
            assert.equal(list.headers.get('set-cookie'), null);
            assert.equal(
              list.headers.get('access-control-allow-credentials'),
              null,
            );
            const body = (await list.json()) as {
              data: { id: string }[];
              meta: { total: number };
            };
            assert.equal(body.meta.total, 3);
            assert.equal(
              (await fetch(url + '/' + body.data[0]!.id)).status,
              200,
            );
            assert.equal((await fetch(url + '?moduleId=bad')).status, 400);
            const notFound = await fetch(
              url + '/' + new Types.ObjectId().toHexString(),
            );
            assert.equal(notFound.status, 404);
            assert.equal(
              ((await notFound.json()) as { error: { code: string } }).error
                .code,
              'TOPIC_NOT_FOUND',
            );
            assert.equal(
              (
                await fetch(
                  url + '?moduleId=' + new Types.ObjectId().toHexString(),
                )
              ).status,
              404,
            );
            assert.equal(
              (await fetch(url + '/' + body.data[0]!.id)).status,
              429,
            );
            assert.equal(
              (
                await fetch(url, {
                  headers: { Origin: 'https://unapproved.example' },
                })
              ).status,
              403,
            );
          } finally {
            await new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
          }
          assert.deepEqual(
            await Promise.all([
              Technology.find().sort({ _id: 1 }).lean(),
              LearningPath.find().sort({ _id: 1 }).lean(),
              Module.find().sort({ _id: 1 }).lean(),
              Topic.find().sort({ _id: 1 }).lean(),
            ]),
            before,
          );
        },
      );
    } finally {
      try {
        const failures: unknown[] = [];
        for (const collection of owned) {
          try {
            await mongoose.connection.db!.collection(collection).drop();
          } catch {
            failures.push(collection);
          }
        }
        assert.equal(failures.length, 0, 'Owned collection cleanup failed');
      } finally {
        await database.disconnect();
      }
    }
  },
);
