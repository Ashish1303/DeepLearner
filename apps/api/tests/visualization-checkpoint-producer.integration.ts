// PREPARED ONLY: separate owner approval and an external ordinary-user retained-
// native-handle/UTC-microsecond/executable/parent/owner/live/exact-Job supervisor
// are mandatory. This file is excluded from *.test.ts offline execution.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import {
  checkpointIndexes,
  createCheckpointRepository,
  mongoCheckpoint,
} from '../src/modules/visualizations/visualization-checkpoint.repository.js';
import { checkpointDefinitionIndex } from '../src/modules/visualizations/visualization-checkpoint-definition.model.js';
import { createSectionEvidenceService } from '../src/modules/progress/section-evidence.service.js';
import { mongoEvidence } from '../src/modules/progress/section-evidence.repository.js';

test(
  'F038 C3b guarded disposable checkpoint integration',
  { timeout: 90000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.ok(
      process.env.F021_TEST_URI ===
        'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
      'Exact isolated loopback target required',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // External safety gate must verify fresh owned storage/27018 and all protected
    // MongoDB/demo/development baselines BEFORE permitting this entry point.
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
      failures: unknown[] = [];
    let verified = false;
    const error = (name: string) => (e: unknown) =>
      e instanceof AppError && e.code === name;
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
      verified = true;
      for (const name of [
        'users',
        'technologies',
        'learningPaths',
        'modules',
        'topics',
        'concepts',
        'visualizations',
        'visualizationCheckpointDefinitions',
        'sectionEvidenceChallenges',
        'sectionActivityReceipts',
        'practiceAttempts',
        'studentProgress',
      ]) {
        await db.createCollection(name, { timeoutMS: 5000 });
        owned.unshift(name);
      }
      for (const i of checkpointIndexes)
        await db
          .collection(i.collection)
          .createIndex(i.key, { name: i.name, unique: true, timeoutMS: 5000 });
      await mongoCheckpoint.ready(5000);
      const owner = new Types.ObjectId(),
        other = new Types.ObjectId(),
        author = new Types.ObjectId(),
        reviewer = new Types.ObjectId(),
        tech = new Types.ObjectId(),
        path = new Types.ObjectId(),
        module = new Types.ObjectId(),
        topic = new Types.ObjectId(),
        concept = new Types.ObjectId(),
        visual = new Types.ObjectId();
      await db.collection('users').insertMany(
        [owner, other, author, reviewer].map((_id) => ({
          _id,
          role:
            _id.equals(author) || _id.equals(reviewer) ? 'ADMIN' : 'STUDENT',
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
        title: 'Synthetic checkpoint Concept',
        slug: 'synthetic-checkpoint',
        difficulty: 'BEGINNER',
        order: 0,
        contentFormat: 'MARKDOWN',
        schemaVersion: 1,
        read: {
          summary: 'Synthetic',
          bodyMarkdown: 'Disposable learning text',
        },
        source: {
          label: 'Synthetic',
          url: 'https://example.invalid/concept',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: false,
        },
      });
      await db.collection('visualizations').insertOne({
        _id: visual,
        conceptId: concept,
        topicId: topic,
        technologyId: tech,
        status: 'PUBLISHED',
        type: 'ANIMATED_FLOW',
        schemaVersion: 1,
        title: 'Synthetic graph',
        textAlternative: 'A retained lexical environment.',
        nodes: [{ id: 'environment', label: 'Environment' }],
        edges: [],
        steps: [
          {
            title: 'Retain',
            explanation: 'The function retains the environment.',
            nodeIds: ['environment'],
            edgeIds: [],
          },
        ],
        createdBy: author,
        updatedBy: author,
      });
      await db.collection('practiceAttempts').insertOne({
        _id: new Types.ObjectId(),
        userId: owner,
        conceptId: concept,
        syntheticSentinel: 'unchanged',
      });
      await db.collection('studentProgress').insertOne({
        _id: new Types.ObjectId(),
        userId: owner,
        conceptId: concept,
        syntheticSentinel: 'unchanged',
      });
      const baseline = {
        attempts: await db.collection('practiceAttempts').find({}).toArray(),
        progress: await db.collection('studentProgress').find({}).toArray(),
      };
      const tokens = createAccessTokens({
        ACCESS_TOKEN_SECRET: Buffer.alloc(32, 16).toString('base64'),
        ACCESS_TOKEN_ISSUER: 'c3b-integration',
        ACCESS_TOKEN_AUDIENCE: 'c3b-integration',
      });
      const tokenFor = (user: Types.ObjectId, role: 'ADMIN' | 'STUDENT') =>
        tokens.sign({
          sub: String(user),
          sid: String(new Types.ObjectId()),
          role,
          plan: 'FREE',
        });
      const student = await tokenFor(owner, 'STUDENT'),
        second = await tokenFor(other, 'STUDENT'),
        admin = await tokenFor(author, 'ADMIN'),
        review = await tokenFor(reviewer, 'ADMIN');
      const service = createVisualizationCheckpointService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const body = {
        conceptId: String(concept),
        visualizationId: String(visual),
        checkpointId: 'retained-environment',
        checkpointVersion: 1,
        prompt: 'What remains available?',
        textAlternative:
          'The returned function retains its lexical environment.',
        choices: [
          { id: 'retained', label: 'Retained environment' },
          { id: 'discarded', label: 'Discarded call frame' },
        ],
        expectedChoiceId: 'retained',
      };
      let version = 0;
      const definition = async () => {
        const d = await service.author(
          admin,
          { ...body, checkpointVersion: ++version },
          'integration',
        );
        await service.approve(review, { definitionId: d.id }, 'integration');
        return d.id;
      };
      const issue = (definitionId: string, key = randomUUID()) =>
        service.issue(
          student,
          { definitionId, idempotencyKey: key },
          'integration',
        );
      const submit = (
        challengeId: string,
        choice = 'retained',
        key = randomUUID(),
        actor = student,
      ) =>
        service.submit(
          actor,
          { challengeId, selectedChoiceId: choice, idempotencyKey: key },
          'integration',
        );
      await t.test(
        'independent approval and immutable author identity',
        async () => {
          const d = await service.author(
            admin,
            { ...body, checkpointVersion: ++version },
            'integration',
          );
          await assert.rejects(
            service.approve(admin, { definitionId: d.id }, 'integration'),
            error('AUTH_FORBIDDEN'),
          );
          await service.approve(review, { definitionId: d.id }, 'integration');
          const row = await db
            .collection('visualizationCheckpointDefinitions')
            .findOne({ _id: new Types.ObjectId(d.id) });
          assert.ok(row!.approvedBy.equals(reviewer));
          assert.equal(row!.approvedFingerprint, row!.definitionFingerprint);
          await assert.rejects(
            service.author(
              admin,
              { ...body, checkpointVersion: version, prompt: 'Changed' },
              'integration',
            ),
            error('VISUALIZATION_CHECKPOINT_CONFLICT'),
          );
        },
      );
      await t.test(
        'LOCAL and current Student/ownership validation',
        async () => {
          const d = await definition(),
            c = await issue(d);
          await assert.rejects(
            submit(c.id, 'retained', randomUUID(), second),
            error('SECTION_CHALLENGE_NOT_FOUND'),
          );
          const remote = createVisualizationCheckpointService(tokens, {
            APP_ENV: 'PRODUCTION',
          });
          await assert.rejects(
            remote.issue(
              student,
              { definitionId: d, idempotencyKey: randomUUID() },
              'integration',
            ),
            error('ROUTE_NOT_FOUND'),
          );
          await db
            .collection('users')
            .updateOne({ _id: owner }, { $set: { status: 'DISABLED' } });
          try {
            await assert.rejects(submit(c.id), error('AUTH_FORBIDDEN'));
          } finally {
            await db
              .collection('users')
              .updateOne({ _id: owner }, { $set: { status: 'ACTIVE' } });
          }
        },
      );
      await t.test(
        'valid correct and incorrect outcomes consume once with exact DTOs',
        async () => {
          for (const choice of ['retained', 'discarded']) {
            const d = await definition(),
              c = await issue(d),
              r = await submit(c.id, choice);
            assert.equal(
              r.outcome,
              choice === 'retained' ? 'CORRECT' : 'INCORRECT',
            );
            assert.equal(r.completionQualification, 'NOT_ESTABLISHED');
            assert.deepEqual(Object.keys(r).sort(), [
              'checkpointId',
              'checkpointVersion',
              'completionQualification',
              'conceptId',
              'id',
              'outcome',
              'respondedAt',
              'visualizationId',
            ]);
            assert.equal(
              await db
                .collection('sectionActivityReceipts')
                .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
              1,
            );
          }
        },
      );
      await t.test(
        'invalid response leaves available challenge and no receipt',
        async () => {
          const d = await definition(),
            c = await issue(d);
          await assert.rejects(
            submit(c.id, 'unknown'),
            error('VALIDATION_ERROR'),
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
        },
      );
      await t.test(
        'same-key issue and response replay plus changed-payload conflict',
        async () => {
          const d = await definition(),
            key = randomUUID(),
            c = await issue(d, key);
          assert.deepEqual(await issue(d, key), c);
          const response = randomUUID(),
            r = await submit(c.id, 'retained', response);
          assert.deepEqual(await submit(c.id, 'retained', response), r);
          await assert.rejects(
            submit(c.id, 'discarded', response),
            error('SECTION_EVIDENCE_CONFLICT'),
          );
        },
      );
      await t.test(
        'concurrent issue and response requests converge without duplicates',
        async () => {
          const d = await definition(),
            key = randomUUID();
          const cs = await Promise.all([issue(d, key), issue(d, key)]);
          assert.equal(cs[0].id, cs[1].id);
          const response = randomUUID(),
            rs = await Promise.all([
              submit(cs[0].id, 'retained', response),
              submit(cs[0].id, 'retained', response),
            ]);
          assert.equal(rs[0].id, rs[1].id);
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(cs[0].id) }),
            1,
          );
        },
      );
      await t.test(
        'one active and three fresh issue limits persist across withdrawn history',
        async () => {
          const d = await definition();
          for (let i = 0; i < 3; i++) {
            const c = await issue(d);
            await assert.rejects(
              issue(d),
              error(
                i === 2
                  ? 'VISUALIZATION_CHECKPOINT_LIMIT'
                  : 'VISUALIZATION_CHECKPOINT_CONFLICT',
              ),
            );
            await service.withdraw(
              student,
              { challengeId: c.id },
              'integration',
            );
          }
          await assert.rejects(
            issue(d),
            error('VISUALIZATION_CHECKPOINT_LIMIT'),
          );
          assert.equal(
            await db.collection('sectionEvidenceChallenges').countDocuments({
              userId: owner,
              definitionId: new Types.ObjectId(d),
            }),
            3,
          );
        },
      );
      await t.test(
        'terminal definition revocation and owner withdrawal suppress replay',
        async () => {
          const d = await definition(),
            c = await issue(d),
            key = randomUUID();
          await submit(c.id, 'retained', key);
          await service.withdraw(student, { challengeId: c.id }, 'integration');
          await assert.rejects(
            submit(c.id, 'retained', key),
            error('SECTION_CHALLENGE_UNAVAILABLE'),
          );
          await service.revokeDefinition(
            admin,
            { definitionId: d },
            'integration',
          );
          await assert.rejects(
            issue(d),
            error('VISUALIZATION_CHECKPOINT_NOT_FOUND'),
          );
        },
      );
      await t.test(
        'publication and visualization revision changes suppress response',
        async () => {
          const d = await definition(),
            c = await issue(d);
          await db
            .collection('visualizations')
            .updateOne({ _id: visual }, { $set: { title: 'Changed graph' } });
          try {
            await assert.rejects(
              submit(c.id),
              error('SECTION_CHALLENGE_UNAVAILABLE'),
            );
          } finally {
            await db
              .collection('visualizations')
              .updateOne(
                { _id: visual },
                { $set: { title: 'Synthetic graph' } },
              );
          }
          await db
            .collection('topics')
            .updateOne({ _id: topic }, { $set: { status: 'DRAFT' } });
          try {
            await assert.rejects(submit(c.id), error('CONCEPT_NOT_FOUND'));
          } finally {
            await db
              .collection('topics')
              .updateOne({ _id: topic }, { $set: { status: 'PUBLISHED' } });
          }
        },
      );
      await t.test(
        'receipt insertion failure rolls back definition/challenge fences and consumption',
        async () => {
          const d = await definition(),
            c = await issue(d),
            before = await db
              .collection('sectionEvidenceChallenges')
              .findOne({ _id: new Types.ObjectId(c.id) });
          const failing = createVisualizationCheckpointService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createCheckpointRepository({
              ...mongoCheckpoint,
              async insertVisualReceipt() {
                throw new Error('controlled insert failure');
              },
            }),
          );
          await assert.rejects(
            failing.submit(
              student,
              {
                challengeId: c.id,
                selectedChoiceId: 'retained',
                idempotencyKey: randomUUID(),
              },
              'integration',
            ),
            error('DEPENDENCY_UNAVAILABLE'),
          );
          assert.deepEqual(
            await db
              .collection('sectionEvidenceChallenges')
              .findOne({ _id: new Types.ObjectId(c.id) }),
            before,
          );
        },
      );
      await t.test(
        'majority proof-loss injection returns no result while committed receipt remains',
        async () => {
          const d = await definition(),
            c = await issue(d),
            key = randomUUID();
          const failing = createVisualizationCheckpointService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createCheckpointRepository({
              ...mongoCheckpoint,
              async visualReceipt(user, identity, read) {
                if (read.majority) return null;
                return mongoCheckpoint.visualReceipt(user, identity, read);
              },
            }),
          );
          await assert.rejects(
            failing.submit(
              student,
              {
                challengeId: c.id,
                selectedChoiceId: 'retained',
                idempotencyKey: key,
              },
              'integration',
            ),
            error('SECTION_EVIDENCE_UNCONFIRMED'),
          );
          assert.equal(
            await db
              .collection('sectionActivityReceipts')
              .countDocuments({ challengeId: new Types.ObjectId(c.id) }),
            1,
          );
          assert.equal(
            (await submit(c.id, 'retained', key)).outcome,
            'CORRECT',
          );
          // Controlled missing proof, not real MongoDB failover or uncertain network commit.
        },
      );
      await t.test(
        'catalog index readiness fails closed while READ retains three-index readiness',
        async () => {
          const d = await definition();
          await db
            .collection(checkpointDefinitionIndex.collection)
            .dropIndex(checkpointDefinitionIndex.name, { timeoutMS: 5000 });
          try {
            await assert.rejects(issue(d), error('DEPENDENCY_UNAVAILABLE'));
            await mongoEvidence.ready(5000);
          } finally {
            await db
              .collection(checkpointDefinitionIndex.collection)
              .createIndex(checkpointDefinitionIndex.key, {
                name: checkpointDefinitionIndex.name,
                unique: true,
                timeoutMS: 5000,
              });
          }
          const read = createSectionEvidenceService(tokens, {
            APP_ENV: 'LOCAL',
          });
          const c = await read.issue(
            student,
            { conceptId: String(concept), idempotencyKey: randomUUID() },
            'integration',
          );
          const receipt = await read.acknowledge(
            student,
            {
              challengeId: c.id,
              acknowledged: true,
              idempotencyKey: randomUUID(),
            },
            'integration',
          );
          assert.equal(receipt.section, 'READ');
        },
      );
      await t.test(
        'exact five-minute expiry is checked independently of wall-clock wait',
        async () => {
          const d = await definition();
          let clock = Date.now();
          const controlled = createVisualizationCheckpointService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createCheckpointRepository(),
            () => new Date(clock),
          );
          const c = await controlled.issue(
            student,
            { definitionId: d, idempotencyKey: randomUUID() },
            'integration',
          );
          clock += 300000;
          await assert.rejects(
            controlled.submit(
              student,
              {
                challengeId: c.id,
                selectedChoiceId: 'retained',
                idempotencyKey: randomUUID(),
              },
              'integration',
            ),
            error('SECTION_CHALLENGE_UNAVAILABLE'),
          );
        },
      );
      await t.test(
        'simultaneous withdrawal and definition restriction fence response/replay',
        async () => {
          for (const kind of ['withdraw', 'definition'] as const) {
            const d = await definition(),
              c = await issue(d),
              key = randomUUID();
            const results = await Promise.allSettled([
              submit(c.id, 'retained', key),
              kind === 'withdraw'
                ? service.withdraw(
                    student,
                    { challengeId: c.id },
                    'integration',
                  )
                : service.revokeDefinition(
                    admin,
                    { definitionId: d },
                    'integration',
                  ),
            ]);
            assert.equal(results[1].status, 'fulfilled');
            assert.ok(
              (await db
                .collection('sectionActivityReceipts')
                .countDocuments({ challengeId: new Types.ObjectId(c.id) })) <=
                1,
            );
            await assert.rejects(submit(c.id, 'retained', key));
          }
        },
      );
      await t.test(
        'private response data is minimized and Practice/progress sentinels are unchanged',
        async () => {
          for (const collection of [
            'sectionEvidenceChallenges',
            'sectionActivityReceipts',
          ])
            for (const row of await db
              .collection(collection)
              .find({})
              .toArray())
              for (const key of [
                'expectedChoiceId',
                'selectedChoiceId',
                'answer',
                'score',
                'idempotencyKey',
                'accessToken',
              ])
                assert.equal(Object.hasOwn(row, key), false);
          assert.deepEqual(
            await db.collection('practiceAttempts').find({}).toArray(),
            baseline.attempts,
          );
          assert.deepEqual(
            await db.collection('studentProgress').find({}).toArray(),
            baseline.progress,
          );
        },
      );
    } catch (e) {
      failures.push(e);
    } finally {
      if (verified && mongoose.connection.db)
        for (const name of owned)
          try {
            await mongoose.connection.db
              .collection(name)
              .drop({ timeoutMS: 5000 });
          } catch (e) {
            failures.push(e);
          }
      try {
        await database.disconnect();
      } catch (e) {
        failures.push(e);
      }
      // External owned-Job supervisor alone owns MongoDB graceful shutdown, Job/port
      // and native-handle verification, storage disposal and protected baselines.
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        'Disposable C3b execution/cleanup incomplete',
      );
  },
);
