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
import {
  Concept,
  type ConceptRecord,
} from '../src/modules/concepts/concept.model.js';
import { conceptRepository } from '../src/modules/concepts/concept.repository.js';
import { createConceptService } from '../src/modules/concepts/concept.service.js';
import { AppError } from '../src/common/errors/app-error.js';

test(
  'F021 isolated concept database and HTTP verification',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    const database = createDatabase(
      mongoose,
      {
        APP_ENV: 'LOCAL',
        MONGODB_TLS: false,
        MONGODB_URI: process.env.F021_TEST_URI,
        MONGODB_DB_NAME: process.env.F021_TEST_DB,
      },
      { info() {}, warn() {}, error() {} },
    );
    const owned: (
      'concepts' | 'topics' | 'modules' | 'learningPaths' | 'technologies'
    )[] = [];
    try {
      await database.connect();
      const db = mongoose.connection.db;
      assert(db);
      assert.equal(db.databaseName, 'deeplearner-f021-test');
      const options = await db.admin().command({ getCmdLineOpts: 1 });
      assert.equal(options.parsed?.replication?.replSet, 'f021-test');
      assert.equal(options.parsed?.net?.bindIp, '127.0.0.1');
      assert.equal(options.parsed?.net?.port, 27018);
      const hello = await db.admin().command({ hello: 1 });
      assert.equal(hello.setName, 'f021-test');
      assert.equal(hello.isWritablePrimary, true);
      assert.deepEqual(await db.listCollections().toArray(), []);
      for (const model of [Technology, LearningPath, Module, Topic, Concept]) {
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
      const modules = await Module.create([
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
      const topicRecord = (slug: string, module = modules[0]!) => ({
        title: 'Synthetic topic',
        slug,
        status: 'PUBLISHED' as const,
        moduleId: module._id,
        learningPathId: module.learningPathId,
        technologyId: module.technologyId,
      });
      const topics = await Topic.create([
        ...modules.map((m, i) => topicRecord('topic-' + i, m)),
        { ...topicRecord('draft'), status: 'DRAFT' },
        { ...topicRecord('archived'), status: 'ARCHIVED' },
        { ...topicRecord('orphan-module'), moduleId: new Types.ObjectId() },
        {
          ...topicRecord('wrong-module-path'),
          learningPathId: learningPaths[6]!._id,
        },
        {
          ...topicRecord('wrong-module-tech'),
          technologyId: technologies[3]!._id,
        },
      ]);
      const first = topics[0]!;
      const record = (
        slug: string,
        status: ConceptRecord['status'] = 'PUBLISHED',
        order = 0,
        parent = first,
      ) => ({
        technologyId: parent.technologyId,
        learningPathId: parent.learningPathId,
        moduleId: parent.moduleId,
        topicId: parent._id,
        title: 'Synthetic concept',
        slug,
        status,
        order,
        difficulty: 'BEGINNER' as const,
        read: {
          summary: 'Synthetic summary',
          bodyMarkdown: '# Untrusted Markdown\n<script>data only</script>',
        },
        source: {
          label: 'Synthetic reference',
          url: 'https://example.invalid/source',
          sourceType: 'OFFICIAL_OR_TRUSTED' as const,
          isOfficial: false,
        },
        createdBy: actor,
        updatedBy: actor,
      });
      const service = createConceptService(conceptRepository);
      const query = { topicId: first._id.toHexString(), page: 1, limit: 2 };
      const missing = (e: unknown) =>
        e instanceof AppError && e.statusCode === 404;
      await t.test(
        'real index enforcement, defaults, archive reservations and concurrent topic-scoped uniqueness',
        async () => {
          const indexes = await Concept.collection.indexes();
          assert.equal(indexes.length, 3);
          assert(
            indexes.some(
              (i) =>
                i.unique &&
                JSON.stringify(i.key) ===
                  JSON.stringify({ topicId: 1, slug: 1 }),
            ),
          );
          assert(
            indexes.some(
              (i) =>
                JSON.stringify(i.key) ===
                JSON.stringify({ topicId: 1, status: 1, order: 1, slug: 1 }),
            ),
          );
          assert(!indexes.some((i) => i.expireAfterSeconds !== undefined));
          const duplicate = (e: unknown) =>
            typeof e === 'object' &&
            e !== null &&
            'code' in e &&
            e.code === 11000;
          const reserved = await Concept.create(record('reserved', 'ARCHIVED'));
          assert.equal(reserved.contentFormat, 'MARKDOWN');
          assert.equal(reserved.schemaVersion, 1);
          await assert.rejects(Concept.create(record('reserved')), duplicate);
          await Concept.create(record('reserved', 'DRAFT', 0, topics[1]!));
          const results = await Promise.allSettled([
            Concept.create(record('race', 'DRAFT')),
            Concept.create(record('race', 'DRAFT')),
          ]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          const rejected = results.find((r) => r.status === 'rejected');
          assert(rejected?.status === 'rejected' && duplicate(rejected.reason));
          await assert.rejects(
            Concept.create({
              ...record('invalid'),
              source: {
                ...record('invalid').source,
                url: 'http://example.invalid',
              },
            }),
            (e: unknown) => e instanceof Error && e.name === 'ValidationError',
          );
        },
      );
      if (t.signal.aborted) return;
      await t.test(
        'five-level publication and reference consistency govern summary/detail, ordering and identical totals',
        async () => {
          const visible = await Concept.create([
            record('beta'),
            record('alpha'),
            record('last', 'PUBLISHED', 1),
          ]);
          const hidden = await Concept.create([
            ...(
              [
                'DRAFT',
                'AI_GENERATED',
                'IN_REVIEW',
                'CHANGES_REQUIRED',
                'APPROVED',
                'ARCHIVED',
              ] as const
            ).map((s) => record(s.toLowerCase().replaceAll('_', '-'), s)),
            ...topics.slice(2).map((p) => record('hidden', 'PUBLISHED', 0, p)),
            { ...record('orphan-topic'), topicId: new Types.ObjectId() },
            { ...record('wrong-module'), moduleId: modules[1]!._id },
            { ...record('orphan-module'), moduleId: new Types.ObjectId() },
            { ...record('wrong-path'), learningPathId: learningPaths[6]!._id },
            { ...record('orphan-path'), learningPathId: new Types.ObjectId() },
            { ...record('wrong-tech'), technologyId: technologies[3]!._id },
            { ...record('orphan-tech'), technologyId: new Types.ObjectId() },
          ]);
          const page = await service.list(query);
          assert.deepEqual(
            page.items.map((x) => x.slug),
            ['alpha', 'beta'],
          );
          assert.equal(page.pagination.total, 3);
          assert.equal(page.pagination.totalPages, 2);
          assert.deepEqual(
            (await service.list({ ...query, page: 2 })).items.map(
              (x) => x.slug,
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
                topicId: topics[1]!._id.toHexString(),
              })
            ).pagination.totalPages,
            0,
          );
          const common = [
            'id',
            'technologyId',
            'learningPathId',
            'moduleId',
            'topicId',
            'title',
            'slug',
            'difficulty',
            'order',
          ];
          for (const dto of page.items)
            assert.deepEqual(
              Object.keys(dto).sort(),
              [...common, 'summary'].sort(),
            );
          for (const item of visible) {
            const dto = await service.detail(item._id.toHexString());
            assert.deepEqual(
              Object.keys(dto).sort(),
              [
                ...common,
                'read',
                'source',
                'contentFormat',
                'schemaVersion',
              ].sort(),
            );
            assert.deepEqual(Object.keys(dto.read).sort(), [
              'bodyMarkdown',
              'summary',
            ]);
            assert.deepEqual(Object.keys(dto.source).sort(), [
              'isOfficial',
              'label',
              'sourceType',
              'url',
            ]);
            assert.equal(dto.read.bodyMarkdown, item.read.bodyMarkdown);
          }
          for (const item of hidden)
            await assert.rejects(
              service.detail(item._id.toHexString()),
              missing,
            );
          for (const parent of topics.slice(2))
            await assert.rejects(
              service.list({ ...query, topicId: parent._id.toHexString() }),
              missing,
            );
          await assert.rejects(
            service.detail(new Types.ObjectId().toHexString()),
            missing,
          );
          await assert.rejects(
            service.list({
              ...query,
              topicId: new Types.ObjectId().toHexString(),
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
            MONGODB_URI: process.env.F021_TEST_URI,
            MONGODB_DB_NAME: process.env.F021_TEST_DB,
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
            Concept.find().sort({ _id: 1 }).lean(),
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
            undefined,
            undefined,
            service,
            { max: 5, windowMs: 900000 },
          ).listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
            const address = server.address();
            assert(address && typeof address !== 'string');
            const url = 'http://127.0.0.1:' + address.port + '/api/v1/concepts';
            const list = await fetch(url + '?topicId=' + query.topicId, {
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
            assert.equal((await fetch(url + '?topicId=bad')).status, 400);
            const notFound = await fetch(
              url + '/' + new Types.ObjectId().toHexString(),
            );
            assert.equal(notFound.status, 404);
            assert.equal(
              ((await notFound.json()) as { error: { code: string } }).error
                .code,
              'CONCEPT_NOT_FOUND',
            );
            assert.equal(
              (
                await fetch(
                  url + '?topicId=' + new Types.ObjectId().toHexString(),
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
              Concept.find().sort({ _id: 1 }).lean(),
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
