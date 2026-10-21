// PREPARED ONLY. Requires separately approved owned-Job/native-handle disposable
// preflight, full thirteen-index allowlist and ONE invocation. Not a *.test.ts.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createCompletionEvidenceService } from '../src/modules/progress/completion-evidence.service.js';
import { createCompletionService } from '../src/modules/progress/completion.service.js';
import {
  completionIndexes,
  createCompletionRepository,
  mongoCompletionStore,
} from '../src/modules/progress/completion.repository.js';
import { completionRequestIndex } from '../src/modules/progress/completion-request.model.js';
import { createSectionEvidenceService } from '../src/modules/progress/section-evidence.service.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import { createPracticeService } from '../src/modules/practice/practice.service.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
import { userRepository } from '../src/modules/users/user.repository.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import { progressRepository } from '../src/modules/progress/progress.repository.js';

export const completionIntegrationIndexes = completionIndexes;
test(
  'F038 Slice 2 guarded disposable completion integration',
  { timeout: 120000 },
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
    const owned: string[] = [];
    let verified = false;
    const tokens = createAccessTokens({
      ACCESS_TOKEN_SECRET: Buffer.alloc(32, 53).toString('base64'),
      ACCESS_TOKEN_ISSUER: 'completion-integration',
      ACCESS_TOKEN_AUDIENCE: 'completion-integration',
    });
    const origin = createCompletionEvidenceService(tokens, {
      APP_ENV: 'LOCAL',
    });
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      const h = await db.admin().command({ hello: 1 }, { timeoutMS: 5000 });
      assert.equal(h.isWritablePrimary, true);
      assert.equal(h.setName, 'f021-test');
      const opts = (
        await db.admin().command({ getCmdLineOpts: 1 }, { timeoutMS: 5000 })
      ).parsed;
      assert.equal(opts.net.bindIp, '127.0.0.1');
      assert.equal(opts.net.port, 27018);
      assert.equal(opts.replication.replSet, 'f021-test');
      const cfg = (
        await db.admin().command({ replSetGetConfig: 1 }, { timeoutMS: 5000 })
      ).config;
      assert.equal(cfg.members.length, 1);
      assert.equal(cfg.members[0].host, '127.0.0.1:27018');
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
        'practiceQuestions',
        'visualizations',
        'practiceAttempts',
        'studentProgress',
        'practiceRubricVersions',
        'practiceRubricAuthorities',
        'practiceAssessments',
        'auditLogs',
        'visualizationCheckpointDefinitions',
        'sectionEvidenceChallenges',
        'sectionActivityReceipts',
        'completionRequests',
      ]) {
        await db.createCollection(name, { timeoutMS: 5000 });
        owned.unshift(name);
      }
      assert.equal(completionIndexes.length, 13);
      assert.equal(
        new Set(completionIndexes.map((i) => i.collection + '/' + i.name)).size,
        13,
      );
      for (const i of completionIndexes) {
        await db.collection(i.collection).createIndex(i.key, {
          name: i.name,
          unique: i.unique,
          timeoutMS: 5000,
        });
        const actual = (
          await db.collection(i.collection).indexes({ timeoutMS: 5000 })
        ).find((v) => v.name === i.name)!;
        assert.deepEqual(actual.key, i.key);
        assert.equal(actual.unique === true, i.unique);
        assert.equal(actual.v, 2);
        assert(
          Object.keys(actual).every((k) =>
            ['v', 'key', 'name', 'unique'].includes(k),
          ),
        );
      }
      const author = new Types.ObjectId(),
        reviewer = new Types.ObjectId(),
        tech = new Types.ObjectId(),
        path = new Types.ObjectId(),
        module = new Types.ObjectId(),
        topic = new Types.ObjectId();
      await db.collection('users').insertMany(
        [author, reviewer].map((_id) => ({
          _id,
          role: 'ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        })),
      );
      await db
        .collection('technologies')
        .insertOne({ _id: tech, status: 'PUBLISHED' });
      await db.collection('learningPaths').insertOne({
        _id: path,
        technologyId: tech,
        status: 'PUBLISHED',
        completionScore: 70,
      });
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
      const sign = (id: string, role: 'ADMIN' | 'STUDENT') =>
        tokens.sign({
          sub: id,
          sid: new Types.ObjectId().toHexString(),
          role,
          plan: 'FREE',
        });
      const admin = await sign(author.toHexString(), 'ADMIN'),
        review = await sign(reviewer.toHexString(), 'ADMIN');
      const rubrics = createPracticeGradingService(tokens, {
          APP_ENV: 'LOCAL',
        }),
        visual = createVisualizationCheckpointService(tokens, {
          APP_ENV: 'LOCAL',
        });
      const completion = createCompletionService(tokens, { APP_ENV: 'LOCAL' }),
        practice = createPracticeService(practiceRepository, userRepository);
      const prepare = async (requireRevise = false, answer = '1') => {
        const created = await origin.create(admin, {
          topicId: topic.toHexString(),
          summary: 'Synthetic Read',
          bodyMarkdown: 'Read this description.',
          example: 'The literal output.',
          prompt: 'What is the output?',
          answer: '1',
          ...(requireRevise
            ? { revise: { summary: 'Review', keyPoints: ['A retained point'] } }
            : {}),
        });
        const visualization = new Types.ObjectId();
        await db.collection('visualizations').insertOne({
          _id: visualization,
          conceptId: new Types.ObjectId(created.conceptId),
          topicId: topic,
          technologyId: tech,
          status: 'PUBLISHED',
          type: 'ANIMATED_FLOW',
          schemaVersion: 1,
          title: 'Synthetic graph',
          textAlternative: 'One retained node.',
          nodes: [{ id: 'node', label: 'Node' }],
          edges: [],
          steps: [
            {
              title: 'Observe',
              explanation: 'One node remains.',
              nodeIds: ['node'],
              edgeIds: [],
            },
          ],
          createdBy: author,
          updatedBy: author,
        });
        const d = await visual.author(
          admin,
          {
            conceptId: created.conceptId,
            visualizationId: visualization.toHexString(),
            checkpointId: 'retained',
            checkpointVersion: 1,
            prompt: 'Which node remains?',
            textAlternative: 'The node remains available.',
            choices: [
              { id: 'yes', label: 'Retained' },
              { id: 'no', label: 'Absent' },
            ],
            expectedChoiceId: 'yes',
          },
          randomUUID(),
        );
        await visual.approve(review, { definitionId: d.id }, randomUUID());
        const source = (await practiceRepository.qualified(
          created.questionId,
          created.conceptId,
        ))!;
        const rubric = await rubrics.author(
          admin,
          {
            questionId: created.questionId,
            conceptId: created.conceptId,
            questionRevision: source.questionRevision,
            type: 'OUTPUT',
            answerForm: 'TEXT',
            comparison: 'EXACT_TEXT',
            normalization: 'NONE',
            expectedAnswer: '1',
          },
          randomUUID(),
        );
        await rubrics.approve(
          review,
          { rubricId: rubric.rubricId, version: rubric.version },
          randomUUID(),
        );
        const policy = await origin.author(admin, {
          conceptId: created.conceptId,
          rubricId: rubric.rubricId,
          rubricVersion: rubric.version,
          checkpointDefinitionId: d.id,
          minimumScore: 70,
          requireRevise,
        });
        await origin.approve(review, {
          conceptId: created.conceptId,
          version: policy.version,
        });
        const subject = { sub: created.userId, role: 'STUDENT' },
          token = await sign(created.userId, 'STUDENT');
        await practice.unlock(subject, {
          conceptId: created.conceptId,
          questionId: created.questionId,
          questionRevision: source.questionRevision,
          studentAnswer: answer,
          idempotencyKey: randomUUID(),
        });
        const acknowledge = async (
          section: 'READ' | 'VISUALIZE' | 'EXAMPLE' | 'REVISE',
        ) => {
          const issue = await completion.issue(
            subject,
            token,
            created.conceptId,
            { section },
            randomUUID(),
            randomUUID(),
          );
          await completion.respond(
            subject,
            token,
            created.conceptId,
            section === 'VISUALIZE'
              ? { challengeId: issue.challenge.id, selectedChoiceId: 'yes' }
              : { challengeId: issue.challenge.id, acknowledged: true },
            randomUUID(),
            randomUUID(),
          );
          return issue.challenge.id;
        };
        return {
          created,
          subject,
          token,
          policy,
          acknowledge,
          get: () => completion.get(subject, created.conceptId),
          complete: (viewRevision: string, key = randomUUID()) =>
            completion.complete(
              subject,
              created.conceptId,
              { viewRevision },
              key,
            ),
        };
      };
      await t.test(
        'missing required evidence is ineligible and GET never mutates the canonical summary',
        async () => {
          const f = await prepare(),
            filter = { userId: new Types.ObjectId(f.created.userId) },
            before = await db.collection('studentProgress').findOne(filter);
          const view = await f.get();
          assert.equal(view.eligibility, 'INELIGIBLE');
          await assert.rejects(f.complete(view.viewRevision));
          assert.deepEqual(
            await db.collection('studentProgress').findOne(filter),
            before,
          );
          assert.equal(
            await db.collection('completionRequests').countDocuments(filter),
            0,
          );
        },
      );
      await t.test(
        'current Read Visualize Example and first graded submission commit one canonical completion with owned request proof',
        async () => {
          const f = await prepare();
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await f.acknowledge(s);
          const view = await f.get();
          assert.equal(view.eligibility, 'ELIGIBLE');
          const key = randomUUID(),
            first = await f.complete(view.viewRevision, key),
            replay = await f.complete(view.viewRevision, key);
          assert.deepEqual(first, replay);
          assert.equal(first.completion.status, 'COMPLETED');
          const filter = { userId: new Types.ObjectId(f.created.userId) },
            row = await db.collection('studentProgress').findOne(filter);
          assert.equal(row!.schemaVersion, 2);
          assert.equal(row!.attemptCount, 1);
          assert.equal(row!.firstScore, 100);
          assert.equal(
            await db.collection('completionRequests').countDocuments(filter),
            1,
          );
          const activity = await progressRepository.read(
            f.created.userId,
            f.created.conceptId,
          );
          assert.equal(Object.keys(activity).length, 5);
          assert.equal(activity.status, 'IN_PROGRESS');
          await assert.rejects(f.complete('f'.repeat(64), key));
          assert.equal((await f.get()).completion.status, 'COMPLETED');
        },
      );
      await t.test(
        'concurrent same-key requests converge without duplicate completion or activity',
        async () => {
          const f = await prepare();
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await f.acknowledge(s);
          const v = await f.get(),
            key = randomUUID();
          const [a, b] = await Promise.all([
            f.complete(v.viewRevision, key),
            f.complete(v.viewRevision, key),
          ]);
          assert.deepEqual(a, b);
          assert.equal(
            await db
              .collection('completionRequests')
              .countDocuments({ userId: new Types.ObjectId(f.created.userId) }),
            1,
          );
          assert.equal(
            (
              await progressRepository.read(
                f.created.userId,
                f.created.conceptId,
              )
            ).attemptCount,
            1,
          );
        },
      );
      await t.test(
        'zero qualifying score and conditional Revise cannot be bypassed',
        async () => {
          const failed = await prepare(false, 'wrong');
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await failed.acknowledge(s);
          const no = await failed.get();
          assert.equal(no.practice.score, 0);
          await assert.rejects(failed.complete(no.viewRevision));
          const f = await prepare(true);
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await f.acknowledge(s);
          assert.equal((await f.get()).eligibility, 'INELIGIBLE');
          await f.acknowledge('REVISE');
          assert.equal((await f.get()).eligibility, 'ELIGIBLE');
        },
      );
      await t.test(
        'withdrawn bound Read receipt invalidates effective completion without GET repair',
        async () => {
          const f = await prepare(),
            read = await f.acknowledge('READ');
          await f.acknowledge('VISUALIZE');
          await f.acknowledge('EXAMPLE');
          const v = await f.get();
          await f.complete(v.viewRevision);
          await createSectionEvidenceService(tokens, {
            APP_ENV: 'LOCAL',
          }).revoke(f.token, { challengeId: read }, randomUUID());
          const filter = { userId: new Types.ObjectId(f.created.userId) },
            before = await db.collection('studentProgress').findOne(filter);
          assert.equal((await f.get()).completion.status, 'REVOKED');
          assert.deepEqual(
            await db.collection('studentProgress').findOne(filter),
            before,
          );
        },
      );
      await t.test(
        'terminal policy revocation cannot restore an old completion by key replay',
        async () => {
          const f = await prepare();
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await f.acknowledge(s);
          const v = await f.get(),
            key = randomUUID();
          await f.complete(v.viewRevision, key);
          await origin.revoke(admin, {
            conceptId: f.created.conceptId,
            version: f.policy.version,
          });
          assert.equal((await f.get()).completion.status, 'REVOKED');
          await assert.rejects(f.complete(v.viewRevision, key));
        },
      );
      await t.test(
        'request-write failure rolls back completion summary and controlled proof loss refuses success',
        async () => {
          const f = await prepare();
          for (const s of ['READ', 'VISUALIZE', 'EXAMPLE'] as const)
            await f.acknowledge(s);
          const v = await f.get();
          const rollback = createCompletionRepository({
            ...mongoCompletionStore,
            async save(before, after, receipt, read) {
              await mongoCompletionStore.save(before, after, receipt, read);
              throw new Error('controlled');
            },
          });
          await assert.rejects(
            rollback.complete(
              f.created.userId,
              f.created.conceptId,
              v.viewRevision,
              randomUUID(),
            ),
          );
          assert.equal((await f.get()).completion.status, 'NOT_COMPLETED');
          const loss = createCompletionRepository({
            ...mongoCompletionStore,
            async summary() {
              return null;
            },
          });
          const key = randomUUID();
          await assert.rejects(
            loss.complete(
              f.created.userId,
              f.created.conceptId,
              v.viewRevision,
              key,
            ),
          );
          assert.equal(
            (await f.complete(v.viewRevision, key)).completion.status,
            'COMPLETED',
          );
        },
      );
      await t.test(
        'missing and nonunique completion request index refuse without partial records',
        async () => {
          const f = await prepare(),
            i = completionRequestIndex;
          for (const nonunique of [false, true]) {
            await db
              .collection(i.collection)
              .dropIndex(i.name, { timeoutMS: 5000 });
            try {
              if (nonunique)
                await db.collection(i.collection).createIndex(i.key, {
                  name: i.name,
                  unique: false,
                  timeoutMS: 5000,
                });
              await assert.rejects(f.get(), { code: 'DEPENDENCY_UNAVAILABLE' });
            } finally {
              if (nonunique)
                await db
                  .collection(i.collection)
                  .dropIndex(i.name, { timeoutMS: 5000 });
              await db.collection(i.collection).createIndex(i.key, {
                name: i.name,
                unique: true,
                timeoutMS: 5000,
              });
            }
          }
        },
      );
      await t.test(
        'cross-account source access and unsafe response fields are rejected',
        async () => {
          const f = await prepare(),
            other = await prepare();
          await assert.rejects(
            completion.get(other.subject, f.created.conceptId),
          );
          const view = await f.get();
          for (const key of [
            'answer',
            'studentAnswer',
            'userId',
            'rubric',
            'contentFingerprint',
            'assessmentId',
          ])
            assert.equal(key in view, false);
        },
      );
    } finally {
      origin.dispose();
      try {
        if (verified && mongoose.connection.db)
          for (const name of owned)
            await mongoose.connection.db
              .collection(name)
              .drop({ timeoutMS: 5000 });
      } finally {
        await database.disconnect();
      }
    }
  },
);
