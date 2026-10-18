// Separately authorized disposable MongoDB gate. Never included in *.test.ts.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { User } from '../src/modules/users/user.model.js';
import { PracticeQuestion } from '../src/modules/practice/practice-question.model.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
test(
  'F031/F032 disposable publication, projection and authenticated HTTP',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // The external approved procedure verifies fresh storage/PID ownership before connecting.
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
    const owned: string[] = [];
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      const hello = await db.admin().command({ hello: 1 });
      assert.equal(hello.isWritablePrimary, true);
      assert.equal(hello.setName, 'f021-test');
      const options = (await db.admin().command({ getCmdLineOpts: 1 })).parsed;
      assert.equal(options.net.bindIp, '127.0.0.1');
      assert.equal(options.net.port, 27018);
      assert.equal(options.replication.replSet, 'f021-test');
      const replica = (await db.admin().command({ replSetGetConfig: 1 }))
        .config;
      assert.equal(replica.members.length, 1);
      assert.equal(replica.members[0].host, '127.0.0.1:27018');
      assert.equal(db.databaseName, 'deeplearner-f021-test');
      assert.deepEqual(await db.listCollections().toArray(), []);
      for (const model of [
        User,
        Technology,
        LearningPath,
        Module,
        Topic,
        Concept,
        PracticeQuestion,
      ]) {
        await model.createCollection();
        owned.unshift(model.collection.name);
      }
      const student = await User.create({
        email: 'f031@example.invalid',
        firstName: 'Synthetic',
        lastName: 'Student',
        authProviders: [
          { provider: 'GOOGLE', providerUserId: 'f031-synthetic-student' },
        ],
        role: 'STUDENT',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      });
      const audit = {
        createdBy: student._id,
        updatedBy: student._id,
        status: 'PUBLISHED' as const,
      };
      const tech = await Technology.create({
        ...audit,
        name: 'Synthetic',
        slug: 'f031-tech',
      });
      const path = await LearningPath.create({
        ...audit,
        technologyId: tech._id,
        title: 'Synthetic',
        slug: 'f031-path',
      });
      const module = await Module.create({
        technologyId: tech._id,
        learningPathId: path._id,
        title: 'Synthetic',
        slug: 'f031-module',
        status: 'PUBLISHED',
      });
      const topic = await Topic.create({
        technologyId: tech._id,
        learningPathId: path._id,
        moduleId: module._id,
        title: 'Synthetic',
        slug: 'f031-topic',
        status: 'PUBLISHED',
      });
      const concept = await Concept.create({
        ...audit,
        technologyId: tech._id,
        learningPathId: path._id,
        moduleId: module._id,
        topicId: topic._id,
        title: 'Synthetic',
        slug: 'f031-concept',
        difficulty: 'BEGINNER',
        read: { summary: 'Summary', bodyMarkdown: 'Read' },
        source: {
          label: 'Synthetic',
          url: 'https://example.invalid',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: false,
        },
      });
      const query = {
        conceptId: concept.id,
        page: 1,
        limit: 10,
        type: 'OUTPUT' as const,
      };
      const base = {
        ...audit,
        technologyId: tech._id,
        topicId: topic._id,
        conceptId: concept._id,
        type: 'OUTPUT',
        difficulty: 'BEGINNER',
        prompt: 'Predict',
        answer: 'ANSWER_SENTINEL',
        explanation: 'EXPLANATION_SENTINEL',
      };
      for (let n = 1; n <= 12; n++)
        await new PracticeQuestion({
          ...base,
          _id: new Types.ObjectId(n.toString(16).padStart(24, '0')),
          starterCode: n === 1 ? '  console.log(1);\n' : null,
          language: n === 1 ? 'JAVASCRIPT' : null,
        }).save();
      for (const patch of [
        { type: 'CODING' },
        { type: 'DESCRIPTIVE' },
        { type: 'SCENARIO' },
        ...[
          'DRAFT',
          'AI_GENERATED',
          'IN_REVIEW',
          'CHANGES_REQUIRED',
          'APPROVED',
          'ARCHIVED',
        ].map((status) => ({ status })),
        { topicId: new Types.ObjectId() },
        { technologyId: new Types.ObjectId() },
        { conceptId: new Types.ObjectId() },
      ])
        await new PracticeQuestion({ ...base, ...patch }).save();
      // Intentionally malformed raw records are confined to this verified disposable DB.
      await db
        .collection('practiceQuestions')
        .insertOne({ ...base, schemaVersion: 2 });
      await db.collection('practiceQuestions').insertOne({ ...base });
      for (let n = 101; n <= 112; n++) {
        await new PracticeQuestion({
          ...base,
          type: 'DESCRIPTIVE',
          _id: new Types.ObjectId(n.toString(16).padStart(24, '0')),
          prompt: 'Explain the binding',
          starterCode: n === 101 ? '  let value = 1;\n' : null,
          language: n === 101 ? 'JAVASCRIPT' : null,
        }).save();
      }
      for (const patch of [
        { status: 'DRAFT' },
        { topicId: new Types.ObjectId() },
        { technologyId: new Types.ObjectId() },
      ])
        await new PracticeQuestion({
          ...base,
          type: 'DESCRIPTIVE',
          ...patch,
        }).save();
      const firstId = new Types.ObjectId('1'.padStart(24, '0'));
      await db
        .collection('practiceQuestions')
        .updateOne(
          { _id: firstId },
          { $set: { evaluation: { secret: 'EVALUATION_SENTINEL' } } },
        );
      await t.test(
        'safe ordered pagination and immutable reads exclude hidden content and answers',
        async () => {
          const before = await db
            .collection('practiceQuestions')
            .find()
            .sort({ _id: 1 })
            .toArray();
          const result = await practiceRepository.list(query);
          assert(result);
          assert.equal(result.total, 12);
          assert.equal(result.items.length, 10);
          assert.deepEqual(
            result.items.map((x) => x.id),
            Array.from({ length: 10 }, (_, i) =>
              (i + 1).toString(16).padStart(24, '0'),
            ),
          );
          assert.equal(result.items[0]!.starterCode, '  console.log(1);\n');
          assert.equal(result.items[1]!.language, null);
          assert.equal(
            (await practiceRepository.list({ ...query, page: 2 }))!.items
              .length,
            2,
          );
          assert.equal(
            (await practiceRepository.list({ ...query, page: 3 }))!.items
              .length,
            0,
          );
          assert.doesNotMatch(
            JSON.stringify(result),
            /SENTINEL|answer|explanation|evaluation|createdBy/,
          );
          assert.deepEqual(
            await db
              .collection('practiceQuestions')
              .find()
              .sort({ _id: 1 })
              .toArray(),
            before,
          );
          assert.equal(PracticeQuestion.schema.options.autoIndex, false);
          assert.deepEqual(
            PracticeQuestion.schema.indexes().map(([keys]) => keys),
            [
              { conceptId: 1, status: 1, difficulty: 1 },
              { technologyId: 1, type: 1, status: 1 },
            ],
          );
          assert.equal(
            (await db.collection('practiceQuestions').indexes()).length,
            1,
          );
        },
      );
      await t.test(
        'F032 descriptive pagination and read-only projection use the same ancestry',
        async () => {
          const before = await db
            .collection('practiceQuestions')
            .find()
            .sort({ _id: 1 })
            .toArray();
          const q = { ...query, type: 'DESCRIPTIVE' as const };
          const first = (await practiceRepository.list(q))!;
          assert.equal(first.total, 13); // Twelve ordered fixtures plus the original valid descriptive fixture.
          assert.equal(first.items.length, 10);
          assert(
            first.items.every(
              (item) =>
                item.type === 'DESCRIPTIVE' && Object.keys(item).length === 7,
            ),
          );
          assert.equal(first.items[0]!.starterCode, '  let value = 1;\n');
          const last = (await practiceRepository.list({ ...q, page: 2 }))!;
          assert.equal(last.items.length, 3);
          assert(first.items.at(-1)!.id < last.items[0]!.id);
          assert.doesNotMatch(
            JSON.stringify([first, last]),
            /SENTINEL|answer|explanation|evaluation|createdBy/,
          );
          assert.deepEqual(
            await db
              .collection('practiceQuestions')
              .find()
              .sort({ _id: 1 })
              .toArray(),
            before,
          );
        },
      );
      await t.test(
        'every ancestor status, absence and denormalized mismatch fail closed',
        async () => {
          for (const [name, key] of [
            ['concepts', concept._id],
            ['topics', topic._id],
            ['modules', module._id],
            ['learningPaths', path._id],
            ['technologies', tech._id],
          ] as const) {
            for (const status of ['DRAFT', 'ARCHIVED']) {
              await db
                .collection(name)
                .updateOne({ _id: key }, { $set: { status } });
              for (const type of ['OUTPUT', 'DESCRIPTIVE'] as const)
                assert.equal(
                  await practiceRepository.list({ ...query, type }),
                  null,
                );
            }
            await db
              .collection(name)
              .updateOne({ _id: key }, { $set: { status: 'PUBLISHED' } });
          }
          for (const [name, key, field, value] of [
            ['concepts', concept._id, 'topicId', topic._id],
            ['concepts', concept._id, 'moduleId', module._id],
            ['concepts', concept._id, 'learningPathId', path._id],
            ['concepts', concept._id, 'technologyId', tech._id],
            ['topics', topic._id, 'moduleId', module._id],
            ['topics', topic._id, 'learningPathId', path._id],
            ['topics', topic._id, 'technologyId', tech._id],
            ['modules', module._id, 'learningPathId', path._id],
            ['modules', module._id, 'technologyId', tech._id],
            ['learningPaths', path._id, 'technologyId', tech._id],
          ] as const) {
            await db
              .collection(name)
              .updateOne(
                { _id: key },
                { $set: { [field]: new Types.ObjectId() } },
              );
            assert.equal(await practiceRepository.list(query), null);
            await db
              .collection(name)
              .updateOne({ _id: key }, { $set: { [field]: value } });
          }
          assert.equal((await practiceRepository.list(query))!.total, 12);
        },
      );
      await t.test(
        'malformed eligible data returns sanitized unavailability',
        async () => {
          await db
            .collection('practiceQuestions')
            .updateOne({ _id: firstId }, { $set: { prompt: 42 } });
          await assert.rejects(practiceRepository.list(query), {
            code: 'DEPENDENCY_UNAVAILABLE',
          });
          await db
            .collection('practiceQuestions')
            .updateOne({ _id: firstId }, { $set: { prompt: 'Predict' } });
        },
      );
      await t.test(
        'real HTTP uses signed Student identity and current eligibility without mutations',
        async () => {
          Object.assign(process.env, {
            EMAIL_PROVIDER: 'disabled',
            LOG_LEVEL: 'silent',
            GOOGLE_CLIENT_ID: '',
            MONGODB_URI: process.env.F021_TEST_URI,
            MONGODB_DB_NAME: process.env.F021_TEST_DB,
            ACCESS_TOKEN_SECRET: Buffer.from(
              Array.from({ length: 32 }, (_, i) => i + 1),
            ).toString('base64'),
            ACCESS_TOKEN_ISSUER: 'f031-test',
            ACCESS_TOKEN_AUDIENCE: 'f031-test',
            AUTH_COOKIE_SECURE: 'false',
            CORS_ORIGINS: 'http://127.0.0.1:3000',
          });
          const { createApp } = await import('../src/app.js');
          const { env } = await import('../src/config/env.js');
          const { createAccessTokens } =
            await import('../src/modules/auth/access-token.service.js');
          const tokens = createAccessTokens(env);
          const token = await tokens.sign({
            sub: student.id,
            sid: new Types.ObjectId().toHexString(),
            role: 'STUDENT',
            plan: 'FREE',
          });
          const server = createApp().listen(0, '127.0.0.1');
          await once(server, 'listening');
          const address = server.address();
          assert(address && typeof address !== 'string');
          const url = `http://127.0.0.1:${address.port}/api/v1/practice-questions?conceptId=${concept.id}`;
          try {
            assert.equal((await fetch(url)).status, 401);
            const before = await db
              .collection('practiceQuestions')
              .find()
              .sort({ _id: 1 })
              .toArray();
            const response = await fetch(url, {
              headers: { Authorization: 'Bearer ' + token },
            });
            assert.equal(response.status, 200);
            const body = await response.text();
            assert.doesNotMatch(
              body,
              /SENTINEL|answer|explanation|evaluation|createdBy/,
            );
            const descriptive = await fetch(url + '&type=DESCRIPTIVE', {
              headers: { Authorization: 'Bearer ' + token },
            });
            assert.equal(descriptive.status, 200);
            const descriptiveBody = (await descriptive.json()) as {
              data: { type: string }[];
              meta: { total: number };
            };
            assert.equal(descriptiveBody.meta.total, 13);
            assert(
              descriptiveBody.data.every(
                (item) =>
                  item.type === 'DESCRIPTIVE' && Object.keys(item).length === 7,
              ),
            );
            assert.doesNotMatch(
              JSON.stringify(descriptiveBody),
              /SENTINEL|answer|explanation|evaluation|createdBy/,
            );
            assert.equal(
              (
                await fetch(url + '&type=SCENARIO', {
                  headers: { Authorization: 'Bearer ' + token },
                })
              ).status,
              400,
            );
            assert.deepEqual(
              await db
                .collection('practiceQuestions')
                .find()
                .sort({ _id: 1 })
                .toArray(),
              before,
            );
            for (const patch of [
              { role: 'ADMIN' },
              { role: 'STUDENT', status: 'SUSPENDED' },
              { status: 'ACTIVE', emailVerifiedAt: null },
            ]) {
              await db
                .collection('users')
                .updateOne({ _id: student._id }, { $set: patch });
              assert.equal(
                (
                  await fetch(url, {
                    headers: { Authorization: 'Bearer ' + token },
                  })
                ).status,
                403,
              );
            }
          } finally {
            await new Promise<void>((resolve, reject) =>
              server.close((error) => (error ? reject(error) : resolve())),
            );
          }
        },
      );
    } finally {
      try {
        for (const name of owned)
          await mongoose.connection.db!.collection(name).drop();
      } finally {
        await database.disconnect();
      }
    }
  },
);
