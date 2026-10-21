// PREPARED ONLY. Separate owner approval and an external retained-handle/Job-owned
// disposable MongoDB launcher are mandatory. Not included in *.test.ts execution.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createSectionEvidenceService } from '../src/modules/progress/section-evidence.service.js';
import {
  createSectionEvidenceRepository,
  mongoEvidence,
  evidenceIndexes,
} from '../src/modules/progress/section-evidence.repository.js';
import { evidenceLifetime } from '../src/modules/progress/section-evidence-revision.js';

test(
  'F038 C2 disposable READ acknowledgement integration',
  { timeout: 90_000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // External preflight, before this entry point: ordinary user; retained native
    // handle/UTC microsecond/executable/parent/owner/live/Job proof; fresh storage;
    // exclusive 27018 ownership and protected MongoDB/demo/development baselines.
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
    const owned: string[] = [],
      cleanupFailures: unknown[] = [];
    let verifiedTarget = false;
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      const hello = await db.admin().command({ hello: 1 }, { timeoutMS: 5000 });
      assert.equal(hello.isWritablePrimary, true);
      assert.equal(hello.setName, 'f021-test');
      const options = (
        await db.admin().command({ getCmdLineOpts: 1 }, { timeoutMS: 5000 })
      ).parsed;
      assert.equal(options.net.bindIp, '127.0.0.1');
      assert.equal(options.net.port, 27018);
      assert.equal(options.replication.replSet, 'f021-test');
      const replica = (
        await db.admin().command({ replSetGetConfig: 1 }, { timeoutMS: 5000 })
      ).config;
      assert.equal(replica.members.length, 1);
      assert.equal(replica.members[0].host, '127.0.0.1:27018');
      assert.equal(db.databaseName, 'deeplearner-f021-test');
      assert.deepEqual(
        await db.listCollections({}, { timeoutMS: 5000 }).toArray(),
        [],
      );
      verifiedTarget = true;
      // Exact collection allowlist: no attempt/progress/rubric/audit provisioning.
      for (const name of [
        'users',
        'technologies',
        'learningPaths',
        'modules',
        'topics',
        'concepts',
        'sectionEvidenceChallenges',
        'sectionActivityReceipts',
      ]) {
        await db.createCollection(name, { timeoutMS: 5000 });
        owned.unshift(name);
      }
      for (const i of evidenceIndexes)
        await db
          .collection(i.collection)
          .createIndex(i.key, { name: i.name, unique: true, timeoutMS: 5000 });
      await mongoEvidence.ready(5000);
      const owner = new Types.ObjectId(),
        other = new Types.ObjectId(),
        tech = new Types.ObjectId(),
        path = new Types.ObjectId(),
        module = new Types.ObjectId(),
        topic = new Types.ObjectId(),
        concept = new Types.ObjectId();
      // Synthetic fixtures only; each hierarchy row carries all denormalized refs.
      await db.collection('users').insertMany(
        [owner, other].map((_id) => ({
          _id,
          role: 'STUDENT',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        })),
      );
      await db
        .collection('technologies')
        .insertOne({ _id: tech, status: 'PUBLISHED' });
      await db
        .collection('learningPaths')
        .insertOne({ _id: path, technologyId: tech, status: 'PUBLISHED' });
      await db.collection('modules').insertOne({
        _id: module,
        technologyId: tech,
        learningPathId: path,
        status: 'PUBLISHED',
      });
      await db.collection('topics').insertOne({
        _id: topic,
        technologyId: tech,
        learningPathId: path,
        moduleId: module,
        status: 'PUBLISHED',
      });
      await db.collection('concepts').insertOne({
        _id: concept,
        technologyId: tech,
        learningPathId: path,
        moduleId: module,
        topicId: topic,
        status: 'PUBLISHED',
        title: 'Synthetic READ',
        slug: 'synthetic-read',
        difficulty: 'BEGINNER',
        order: 0,
        contentFormat: 'MARKDOWN',
        schemaVersion: 1,
        read: {
          summary: 'Synthetic',
          bodyMarkdown: 'Disposable read content',
        },
        source: {
          label: 'Synthetic',
          url: 'https://example.invalid/read',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: false,
        },
      });
      const tokens = createAccessTokens({
        ACCESS_TOKEN_SECRET: Buffer.alloc(32, 12).toString('base64'),
        ACCESS_TOKEN_ISSUER: 'c2-integration',
        ACCESS_TOKEN_AUDIENCE: 'c2-integration',
      });
      const tokenFor = (
        user: Types.ObjectId,
        role: 'STUDENT' | 'ADMIN' = 'STUDENT',
      ) =>
        tokens.sign({
          sub: user.toHexString(),
          sid: new Types.ObjectId().toHexString(),
          role,
          plan: 'FREE',
        });
      const token = await tokenFor(owner),
        otherToken = await tokenFor(other);
      const service = createSectionEvidenceService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const issue = (key = randomUUID()) =>
        service.issue(
          token,
          { conceptId: concept.toHexString(), idempotencyKey: key },
          'c2-integration',
        );
      const ack = (id: string, key = randomUUID(), actor = token) =>
        service.acknowledge(
          actor,
          { challengeId: id, acknowledged: true, idempotencyKey: key },
          'c2-integration',
        );
      const error = (value: string) => (e: unknown) =>
        e instanceof AppError && e.code === value;
      await t.test('current Student and LOCAL-only authorization', async () => {
        await assert.rejects(
          service.issue('invalid', {}, 'test'),
          error('AUTH_ACCESS_TOKEN_INVALID'),
        );
        await assert.rejects(
          service.issue(
            await tokenFor(owner, 'ADMIN'),
            { conceptId: concept.toHexString(), idempotencyKey: randomUUID() },
            'test',
          ),
          error('AUTH_FORBIDDEN'),
        );
        const remote = createSectionEvidenceService(tokens, {
          APP_ENV: 'PRODUCTION',
        });
        await assert.rejects(
          remote.issue(
            token,
            { conceptId: concept.toHexString(), idempotencyKey: randomUUID() },
            'test',
          ),
          error('ROUTE_NOT_FOUND'),
        );
        for (const change of [
          { role: 'ADMIN' },
          { status: 'SUSPENDED' },
          { emailVerifiedAt: null },
        ]) {
          await db
            .collection('users')
            .updateOne({ _id: owner }, { $set: change });
          await assert.rejects(issue(), error('AUTH_FORBIDDEN'));
          await db.collection('users').updateOne(
            { _id: owner },
            {
              $set: {
                role: 'STUDENT',
                status: 'ACTIVE',
                emailVerifiedAt: new Date(),
              },
            },
          );
        }
      });
      await t.test(
        'five-level publication and reference consistency',
        async () => {
          for (const [name, _id] of [
            ['technologies', tech],
            ['learningPaths', path],
            ['modules', module],
            ['topics', topic],
            ['concepts', concept],
          ] as const) {
            await db
              .collection(name)
              .updateOne({ _id }, { $set: { status: 'DRAFT' } });
            await assert.rejects(issue(), error('CONCEPT_NOT_FOUND'));
            await db
              .collection(name)
              .updateOne({ _id }, { $set: { status: 'PUBLISHED' } });
          }
          await db
            .collection('concepts')
            .updateOne(
              { _id: concept },
              { $set: { technologyId: new Types.ObjectId() } },
            );
          await assert.rejects(issue(), error('CONCEPT_NOT_FOUND'));
          await db
            .collection('concepts')
            .updateOne({ _id: concept }, { $set: { technologyId: tech } });
        },
      );
      await t.test(
        'issue identity and exact owned activity receipt replay',
        async () => {
          const k = randomUUID(),
            c = await issue(k),
            a = randomUUID();
          assert.deepEqual(await issue(k), c);
          const r = await ack(c.id, a);
          assert.deepEqual(await ack(c.id, a), r);
          assert.deepEqual(
            Object.keys(r).sort(),
            [
              'id',
              'conceptId',
              'section',
              'acknowledgedAt',
              'completionQualification',
            ].sort(),
          );
          assert.equal(r.completionQualification, 'NOT_ESTABLISHED');
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
            1,
          );
          await assert.rejects(
            ack(c.id, randomUUID(), otherToken),
            error('SECTION_CHALLENGE_NOT_FOUND'),
          );
          await assert.rejects(
            ack(c.id),
            error('SECTION_CHALLENGE_UNAVAILABLE'),
          );
          const otherChallenge = await issue();
          await assert.rejects(
            ack(otherChallenge.id, a),
            error('SECTION_EVIDENCE_CONFLICT'),
          );
        },
      );
      await t.test('snapshot changes invalidate acknowledgement', async () => {
        const c = await issue();
        await db
          .collection('concepts')
          .updateOne(
            { _id: concept },
            { $set: { 'read.bodyMarkdown': 'Changed synthetic content' } },
          );
        await assert.rejects(ack(c.id), error('SECTION_CHALLENGE_UNAVAILABLE'));
        await db
          .collection('concepts')
          .updateOne(
            { _id: concept },
            { $set: { 'read.bodyMarkdown': 'Disposable read content' } },
          );
      });
      await t.test(
        'concurrent identical submissions produce one receipt',
        async () => {
          const c = await issue(),
            k = randomUUID(),
            results = await Promise.all([
              ack(c.id, k),
              ack(c.id, k),
              ack(c.id, k),
            ]);
          assert.equal(new Set(results.map((r) => r.id)).size, 1);
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
            1,
          );
        },
      );
      await t.test(
        'concurrent distinct acknowledgements consume once',
        async () => {
          const c = await issue(),
            results = await Promise.allSettled([ack(c.id), ack(c.id)]);
          assert.equal(
            results.filter((r) => r.status === 'fulfilled').length,
            1,
          );
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
            1,
          );
        },
      );
      await t.test(
        'terminal withdrawal preserves receipts and blocks replay',
        async () => {
          const c = await issue(),
            k = randomUUID();
          await ack(c.id, k);
          const before = await db
            .collection('sectionActivityReceipts')
            .findOne({ challengeId: new Types.ObjectId(c.id) });
          await service.revoke(token, { challengeId: c.id }, 'withdraw');
          await assert.rejects(
            ack(c.id, k),
            error('SECTION_CHALLENGE_UNAVAILABLE'),
          );
          assert.deepEqual(
            await db
              .collection('sectionActivityReceipts')
              .findOne({ challengeId: new Types.ObjectId(c.id) }),
            before,
          );
          const unused = await issue();
          await service.revoke(token, { challengeId: unused.id }, 'withdraw');
          await assert.rejects(
            ack(unused.id),
            error('SECTION_CHALLENGE_UNAVAILABLE'),
          );
        },
      );
      await t.test('expiry enforcement uses server time, not TTL', async () => {
        const c = await issue();
        const row = await db
          .collection('sectionEvidenceChallenges')
          .findOne({ _id: new Types.ObjectId(c.id) });
        const expired = createSectionEvidenceService(
          tokens,
          { APP_ENV: 'LOCAL' },
          createSectionEvidenceRepository(),
          () => new Date(row!.issuedAt.getTime() + evidenceLifetime),
        );
        await assert.rejects(
          expired.acknowledge(
            token,
            {
              challengeId: c.id,
              acknowledged: true,
              idempotencyKey: randomUUID(),
            },
            'test',
          ),
          error('SECTION_CHALLENGE_UNAVAILABLE'),
        );
      });
      await t.test('receipt failure rolls back consumed state', async () => {
        const c = await issue();
        const faulty = createSectionEvidenceService(
          tokens,
          { APP_ENV: 'LOCAL' },
          createSectionEvidenceRepository({
            ...mongoEvidence,
            async insertReceipt() {
              throw new Error('controlled insert failure');
            },
          }),
        );
        await assert.rejects(
          faulty.acknowledge(
            token,
            {
              challengeId: c.id,
              acknowledged: true,
              idempotencyKey: randomUUID(),
            },
            'test',
          ),
          error('DEPENDENCY_UNAVAILABLE'),
        );
        assert.equal(
          (await db
            .collection('sectionEvidenceChallenges')
            .findOne({ _id: new Types.ObjectId(c.id) }))!.state,
          'AVAILABLE',
        );
        assert.equal(
          await db
            .collection('sectionActivityReceipts')
            .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
          0,
        );
      });
      await t.test(
        'controlled majority proof loss refuses result without asserting rollback',
        async () => {
          const c = await issue(),
            k = randomUUID();
          const faulty = createSectionEvidenceService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createSectionEvidenceRepository({
              ...mongoEvidence,
              async receipt(user, identity, read) {
                return read.majority
                  ? null
                  : mongoEvidence.receipt(user, identity, read);
              },
            }),
          );
          await assert.rejects(
            faulty.acknowledge(
              token,
              { challengeId: c.id, acknowledged: true, idempotencyKey: k },
              'test',
            ),
            error('SECTION_EVIDENCE_UNCONFIRMED'),
          );
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
            1,
          );
          await ack(c.id, k); // Explicit recovery, not a test-suite invocation retry.
        },
      );
      await t.test(
        'missing and nonunique required indexes refuse all writes',
        async () => {
          const i = evidenceIndexes[0]!,
            collection = db.collection(i.collection);
          await collection.dropIndex(i.name);
          await assert.rejects(issue(), error('DEPENDENCY_UNAVAILABLE'));
          await collection.createIndex(i.key, { name: i.name, unique: false });
          await assert.rejects(issue(), error('DEPENDENCY_UNAVAILABLE'));
          await collection.dropIndex(i.name);
          await collection.createIndex(i.key, { name: i.name, unique: true });
        },
      );
      await t.test(
        'no sensitive duplication or existing-feature mutations',
        async () => {
          for (const name of [
            'sectionEvidenceChallenges',
            'sectionActivityReceipts',
          ]) {
            const rows = await db.collection(name).find().toArray();
            assert.ok(rows.length > 0);
            for (const row of rows)
              for (const field of [
                'studentAnswer',
                'answer',
                'explanation',
                'bodyMarkdown',
                'idempotencyKey',
                'score',
                'assessmentId',
              ])
                assert.ok(!(field in row));
          }
          for (const name of [
            'practiceAttempts',
            'studentProgress',
            'practiceAssessments',
            'auditLogs',
          ])
            assert.equal(await db.collection(name).countDocuments({}), 0);
        },
      );
    } catch (e) {
      cleanupFailures.push(e);
    } finally {
      if (verifiedTarget && mongoose.connection.db)
        for (const name of owned)
          try {
            await mongoose.connection.db
              .collection(name)
              .drop({ timeoutMS: 5000 });
          } catch (e) {
            cleanupFailures.push(e);
          }
      try {
        await database.disconnect();
      } catch (e) {
        cleanupFailures.push(e);
      }
      // External launcher owns graceful process shutdown, Job/port/native handles,
      // disposable storage removal and protected baseline verification.
    }
    if (cleanupFailures.length)
      throw new AggregateError(
        cleanupFailures,
        'Disposable C2 execution/cleanup incomplete',
      );
  },
);
