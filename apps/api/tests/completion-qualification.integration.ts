// PREPARED ONLY. Separate owner approval, exact index allowlist and the existing
// retained-native-handle/Job-owned disposable launcher are mandatory. This file
// is intentionally excluded from *.test.ts. Never run against persistent data.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { createDatabase, mongoose } from '../src/config/database.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createCompletionEvidenceService } from '../src/modules/progress/completion-evidence.service.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import { createSectionEvidenceService } from '../src/modules/progress/section-evidence.service.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
import { createPracticeService } from '../src/modules/practice/practice.service.js';
import { userRepository } from '../src/modules/users/user.repository.js';
import {
  createPracticeAttemptRepository,
  mongoAttemptStore,
  practiceAttemptCoordination,
} from '../src/modules/practice/practice-attempt.repository.js';
import { completionGrading } from '../src/modules/practice/completion-grading.service.js';
import { attemptIndexes } from '../src/modules/practice/practice-attempt.model.js';
import { gradingIndexes } from '../src/modules/practice/practice-assessment.repository.js';
import { checkpointIndexes } from '../src/modules/visualizations/visualization-checkpoint.repository.js';
import { progressIndex } from '../src/modules/progress/progress.model.js';

export const qualificationIntegrationIndexes = [
  ...attemptIndexes.map((i) => ({ ...i, collection: 'practiceAttempts' })),
  { ...progressIndex, collection: 'studentProgress' },
  ...gradingIndexes,
  ...checkpointIndexes,
];
test(
  'F038 Slice 1 guarded disposable qualification integration',
  { timeout: 120_000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // External supervisor preflight remains mandatory: ordinary user; retained
    // handles, exact Job/executable/parent/owner/live state and microsecond UTC
    // creation identity; fresh storage; protected process/data baselines. The env
    // checks above authorize neither ownership nor application origin authority.
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
    try {
      await database.connect();
      const db = mongoose.connection.db!;
      const hello = await db.admin().command({ hello: 1 }, { timeoutMS: 5000 });
      assert.equal(hello.isWritablePrimary, true);
      assert.equal(hello.setName, 'f021-test');
      const opts = (
        await db.admin().command({ getCmdLineOpts: 1 }, { timeoutMS: 5000 })
      ).parsed;
      assert.equal(opts.net.bindIp, '127.0.0.1');
      assert.equal(opts.net.port, 27018);
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
      ]) {
        await db.createCollection(name, { timeoutMS: 5000 });
        owned.unshift(name);
      }
      assert.equal(
        new Set(
          qualificationIntegrationIndexes.map(
            (i) => `${i.collection}/${i.name}`,
          ),
        ).size,
        qualificationIntegrationIndexes.length,
      );
      for (const index of qualificationIntegrationIndexes) {
        await db.collection(index.collection).createIndex(index.key, {
          name: index.name,
          unique: index.unique,
          timeoutMS: 5000,
        });
        const actual = (
          await db.collection(index.collection).indexes({ timeoutMS: 5000 })
        ).find((i) => i.name === index.name)!;
        assert.deepEqual(actual.key, index.key);
        assert.equal(actual.unique === true, index.unique);
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
      const tokens = createAccessTokens({
        ACCESS_TOKEN_SECRET: Buffer.alloc(32, 31).toString('base64'),
        ACCESS_TOKEN_ISSUER: 'qualification-integration',
        ACCESS_TOKEN_AUDIENCE: 'qualification-integration',
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
      const service = createCompletionEvidenceService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const rubricService = createPracticeGradingService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const checkpointService = createVisualizationCheckpointService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const studentPractice = createPracticeService(
        practiceRepository,
        userRepository,
      );
      const rubricAuthorCommandIds = new Set<string>();
      const prepare = async () => {
        const rubricAuthorCommandId = randomUUID();
        assert.equal(rubricAuthorCommandIds.has(rubricAuthorCommandId), false);
        rubricAuthorCommandIds.add(rubricAuthorCommandId);
        const origin = await service.create(admin, {
          topicId: topic.toHexString(),
          summary: 'Synthetic',
          bodyMarkdown: 'Read this description.',
          example: 'The output is a literal.',
          prompt: 'What is the output?',
          answer: '1',
        });
        const visual = new Types.ObjectId();
        await db.collection('visualizations').insertOne({
          _id: visual,
          conceptId: new Types.ObjectId(origin.conceptId),
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
              explanation: 'A retained node.',
              nodeIds: ['node'],
              edgeIds: [],
            },
          ],
          createdBy: author,
          updatedBy: author,
        });
        const checkpoint = await checkpointService.author(
          admin,
          {
            conceptId: origin.conceptId,
            visualizationId: visual.toHexString(),
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
          'definition',
        );
        await checkpointService.approve(
          review,
          { definitionId: checkpoint.id },
          'review',
        );
        const source = (await practiceRepository.qualified(
          origin.questionId,
          origin.conceptId,
        ))!;
        const rubric = await rubricService.author(
          admin,
          {
            questionId: origin.questionId,
            conceptId: origin.conceptId,
            questionRevision: source.questionRevision,
            type: 'OUTPUT',
            answerForm: 'TEXT',
            comparison: 'EXACT_TEXT',
            normalization: 'NONE',
            expectedAnswer: '1',
          },
          rubricAuthorCommandId,
        );
        await rubricService.approve(
          review,
          { rubricId: rubric.rubricId, version: rubric.version },
          'review',
        );
        const policy = await service.author(admin, {
          conceptId: origin.conceptId,
          rubricId: rubric.rubricId,
          rubricVersion: rubric.version,
          checkpointDefinitionId: checkpoint.id,
          minimumScore: 70,
        });
        const input = {
          conceptId: origin.conceptId,
          questionId: origin.questionId,
          questionRevision: source.questionRevision,
          studentAnswer: '1',
          idempotencyKey: randomUUID(),
        };
        return {
          origin,
          source,
          rubric,
          policy,
          checkpoint,
          input,
          token: await sign(origin.userId, 'STUDENT'),
          approve: () =>
            service.approve(review, {
              conceptId: origin.conceptId,
              version: policy.version,
            }),
          submit: (change = {}) =>
            studentPractice.unlock(
              { sub: origin.userId, role: 'STUDENT' },
              { ...input, ...change },
            ),
        };
      };
      await t.test(
        'server-created origin is fresh; unsealed first submission refuses without partial records',
        async () => {
          const f = await prepare();
          await assert.rejects(f.submit());
          assert.equal(
            await db
              .collection('practiceAttempts')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'independent approval and atomic first attempt/assessment/activity precede disclosure',
        async () => {
          const f = await prepare();
          await assert.rejects(
            service.approve(admin, {
              conceptId: f.origin.conceptId,
              version: f.policy.version,
            }),
          );
          await f.approve();
          const result = await f.submit();
          assert.equal(result.data.answer, '1');
          const attempt = await db
            .collection('practiceAttempts')
            .findOne({ _id: new Types.ObjectId(result.attempt.id) });
          assert.equal(attempt!.score, null);
          assert.equal(attempt!.result, 'SUBMITTED');
          const grade = await db
            .collection('practiceAssessments')
            .findOne({ attemptId: attempt!._id, purpose: 'COMPLETION_INPUT' });
          assert.equal(grade!.score, 100);
          assert.equal('studentAnswer' in grade!, false);
          assert.equal('expectedAnswer' in grade!, false);
          const progress = await db.collection('studentProgress').findOne({
            userId: attempt!.userId,
            conceptId: attempt!.conceptId,
          });
          assert.equal(progress!.attemptCount, 1);
          assert.equal(progress!.status, 'IN_PROGRESS');
        },
      );
      await t.test(
        'same-request concurrent replay converges; changed payload conflicts',
        async () => {
          const f = await prepare();
          await f.approve();
          const observe = (requestId: 'concurrent-A' | 'concurrent-B') => {
            const events: Record<string, string | number | boolean | null>[] =
              [];
            let started: number | undefined;
            let stage = 'authorization';
            let callbacks = 0;
            let transactionStarts = 0;
            let transactionCalls = 0;
            let commitAcknowledgements = 0;
            let attemptProof = 'NOT_REACHED';
            let assessmentProof = 'NOT_REACHED';
            let resultStatus = 'PENDING';
            let declaredErrorStatus: number | null = null;
            let disclosed = false;
            let droppedEvents = 0;
            const safeError = (error: unknown) => {
              const row = error as {
                name?: unknown;
                code?: unknown;
                errorLabels?: unknown;
              } | null;
              const names = [
                'AppError',
                'Error',
                'MongoServerError',
                'MongoNetworkError',
                'MongoOperationTimeoutError',
                'MongoTransactionError',
                'MongoWriteConcernError',
              ];
              const codes = [
                'DEPENDENCY_UNAVAILABLE',
                'PRACTICE_COMMIT_UNCONFIRMED',
                'PRACTICE_IDEMPOTENCY_CONFLICT',
                'PRACTICE_ASSESSMENT_CONFLICT',
                'PRACTICE_QUESTION_CHANGED',
              ];
              const labels = Array.isArray(row?.errorLabels)
                ? row.errorLabels.filter((label) =>
                    [
                      'TransientTransactionError',
                      'UnknownTransactionCommitResult',
                      'RetryableWriteError',
                      'NoWritesPerformed',
                    ].includes(label),
                  )
                : [];
              return {
                errorName:
                  typeof row?.name === 'string' && names.includes(row.name)
                    ? row.name
                    : 'UNKNOWN',
                errorCode:
                  typeof row?.code === 'number'
                    ? row.code
                    : typeof row?.code === 'string' && codes.includes(row.code)
                      ? row.code
                      : 'UNKNOWN',
                errorLabels: labels.slice(0, 4).join(','),
              };
            };
            const event = (
              name: string,
              fields: Record<string, string | number | boolean | null> = {},
              now = performance.now(),
            ) => {
              if (events.length >= 256) {
                droppedEvents++;
                return;
              }
              const elapsed = started === undefined ? null : now - started;
              events.push({
                event: name,
                stage,
                callbacks,
                transactionStarts,
                transactionCalls,
                elapsedMs: elapsed,
                remainingMs:
                  elapsed === null ? null : Math.floor(10_000 - elapsed),
                remainingBodies: Math.max(0, 3 - callbacks),
                ...fields,
              });
            };
            const operation = async <T>(
              name: string,
              run: () => Promise<T>,
            ) => {
              stage = name;
              event('operation-start');
              try {
                const result = await run();
                event('operation-return');
                return result;
              } catch (error) {
                event('operation-error', safeError(error));
                throw error;
              }
            };
            const repository = createPracticeAttemptRepository(
              {
                ...mongoAttemptStore,
                async session() {
                  const session = await mongoAttemptStore.session();
                  const start = session.startTransaction.bind(session);
                  const commit = session.commitTransaction.bind(session);
                  const transact = session.withTransaction.bind(session);
                  session.startTransaction = (...args) => {
                    start(...args);
                    transactionStarts++;
                    stage = 'transaction-start';
                    event('transaction-started');
                  };
                  session.commitTransaction = async (...args) => {
                    stage = 'commit';
                    event('commit-start');
                    try {
                      await commit(...args);
                      commitAcknowledgements++;
                      event('commit-acknowledged');
                    } catch (error) {
                      event('commit-error', safeError(error));
                      throw error;
                    }
                  };
                  session.withTransaction = (async (fn, options) => {
                    transactionCalls++;
                    event('withTransaction-start', {
                      timeoutMs: options?.timeoutMS ?? null,
                      majority: options?.writeConcern?.w === 'majority',
                      journal: options?.writeConcern?.j === true,
                    });
                    return transact(async (active) => {
                      callbacks++;
                      stage = 'callback-entry';
                      event('callback-entry', {
                        bodyLimitExceeded: callbacks > 3,
                      });
                      try {
                        return await fn(active);
                      } catch (error) {
                        event('callback-error', safeError(error));
                        throw error;
                      }
                    }, options);
                  }) as typeof session.withTransaction;
                  return session;
                },
                qualified: (...args) =>
                  operation('qualified', () =>
                    mongoAttemptStore.qualified(...args),
                  ),
                byKey: (...args) =>
                  operation('by-key', () => mongoAttemptStore.byKey(...args)),
                progressBefore: (...args) =>
                  operation('progress-before', () =>
                    mongoAttemptStore.progressBefore(...args),
                  ),
                last: (...args) =>
                  operation('last-attempt', () =>
                    mongoAttemptStore.last(...args),
                  ),
                insert: (...args) =>
                  operation('attempt-insert', () =>
                    mongoAttemptStore.insert(...args),
                  ),
                progressAfter: (...args) =>
                  operation('progress-after', () =>
                    mongoAttemptStore.progressAfter(...args),
                  ),
                proof: (...args) =>
                  operation('attempt-majority-read', () =>
                    mongoAttemptStore.proof(...args),
                  ),
              },
              () => {
                const now = performance.now();
                started ??= now;
                event('repository-clock-read', {}, now);
                return now;
              },
              {
                before: (...args) =>
                  operation('qualification-ready', () =>
                    completionGrading.before(...args),
                  ),
                record: (...args) =>
                  operation('qualification-record', () =>
                    completionGrading.record(...args),
                  ),
                async proof(...args) {
                  // F036 calls this only after its exact owned attempt proof passes.
                  attemptProof = 'VERIFIED';
                  assessmentProof = 'STARTED';
                  try {
                    await operation('qualification-proof', () =>
                      completionGrading.proof(...args),
                    );
                    assessmentProof = 'VERIFIED';
                  } catch (error) {
                    assessmentProof = 'FAILED';
                    throw error;
                  }
                },
              },
              practiceAttemptCoordination,
            );
            const practice = createPracticeService(
              practiceRepository,
              userRepository,
              repository,
            );
            const promise = practice
              .unlock({ sub: f.origin.userId, role: 'STUDENT' }, { ...f.input })
              .then(
                (result) => {
                  resultStatus = 'FULFILLED';
                  disclosed = Object.hasOwn(result.data, 'answer');
                  event('result-return', { disclosed });
                  return result;
                },
                (error: unknown) => {
                  resultStatus = 'REJECTED';
                  const status = (error as { statusCode?: unknown } | null)
                    ?.statusCode;
                  declaredErrorStatus =
                    typeof status === 'number' && status >= 400 && status <= 599
                      ? status
                      : null;
                  event('result-error', safeError(error));
                  throw error;
                },
              );
            return {
              promise,
              snapshot: () => ({
                requestId,
                callbacks,
                transactionStarts,
                transactionCalls,
                commitAcknowledgements,
                attemptProof,
                assessmentProof,
                httpStatus: 'NOT_APPLICABLE_INTERNAL_SERVICE',
                resultStatus,
                declaredErrorStatus,
                disclosed,
                droppedEvents,
                events,
              }),
            };
          };
          const observed = [observe('concurrent-A'), observe('concurrent-B')];
          const requests = observed.map((request) => request.promise);
          let pair: Awaited<ReturnType<typeof f.submit>>[];
          try {
            pair = await Promise.all(requests);
          } finally {
            await Promise.allSettled(requests);
            await writeFile(
              new URL(
                `../../../.cache/f038-slice1-concurrency-observation-${randomUUID()}.json`,
                import.meta.url,
              ),
              JSON.stringify({
                requests: observed.map((request) => request.snapshot()),
              }),
              { encoding: 'utf8', flag: 'wx' },
            ).catch(() => {
              t.diagnostic('F038_CONCURRENCY_EVIDENCE_WRITE_FAILED');
            });
          }
          const [a, b] = pair;
          assert.deepEqual(a, b);
          await assert.rejects(f.submit({ studentAnswer: 'changed' }));
          assert.equal(
            await db
              .collection('practiceAttempts')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            1,
          );
          assert.equal(
            await db.collection('practiceAssessments').countDocuments({
              userId: new Types.ObjectId(f.origin.userId),
              purpose: 'COMPLETION_INPUT',
            }),
            1,
          );
        },
      );
      await t.test(
        'failed first response stays zero; later reveal-assisted submission never replaces grade',
        async () => {
          const f = await prepare();
          await f.approve();
          await f.submit({ studentAnswer: 'wrong' });
          await f.submit({ idempotencyKey: randomUUID() });
          const grades = await db
            .collection('practiceAssessments')
            .find({ userId: new Types.ObjectId(f.origin.userId) })
            .toArray();
          assert.equal(grades.length, 1);
          assert.equal(grades[0]!.score, 0);
        },
      );
      await t.test(
        'READ and EXAMPLE remain activity-only; qualifying adapter never writes completion',
        async () => {
          const f = await prepare();
          await f.approve();
          for (const section of ['READ', 'EXAMPLE'] as const) {
            const producer = createSectionEvidenceService(
              tokens,
              { APP_ENV: 'LOCAL' },
              undefined,
              () => new Date(),
              section,
            );
            const c = await producer.issue(
              f.token,
              { conceptId: f.origin.conceptId, idempotencyKey: randomUUID() },
              'issue',
            );
            const r = await producer.acknowledge(
              f.token,
              {
                challengeId: c.id,
                acknowledged: true,
                idempotencyKey: randomUUID(),
              },
              'ack',
            );
            assert.equal(r.completionQualification, 'NOT_ESTABLISHED');
          }
          assert.equal(
            (await service.actions(f.token, f.origin.conceptId)).length,
            2,
          );
          assert.equal(
            await db
              .collection('studentProgress')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'terminal policy revocation fails closed without first attempt or disclosure',
        async () => {
          const f = await prepare();
          await f.approve();
          await service.revoke(admin, {
            conceptId: f.origin.conceptId,
            version: f.policy.version,
          });
          await assert.rejects(f.submit());
          assert.equal(
            await db
              .collection('practiceAttempts')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'progress failure rolls back both attempt and qualifying assessment',
        async () => {
          const f = await prepare();
          await f.approve();
          const repository = createPracticeAttemptRepository(
            {
              ...mongoAttemptStore,
              async progressAfter() {
                throw Error('controlled-summary-failure');
              },
            },
            undefined,
            completionGrading,
          );
          await assert.rejects(repository.submit(f.origin.userId, f.input));
          for (const name of [
            'practiceAttempts',
            'practiceAssessments',
            'studentProgress',
          ])
            assert.equal(
              await db.collection(name).countDocuments({
                userId: new Types.ObjectId(f.origin.userId),
              }),
              0,
            );
        },
      );
      await t.test(
        'controlled majority proof loss suppresses disclosure; exact retry recovers original grade',
        async () => {
          const f = await prepare();
          await f.approve();
          const repository = createPracticeAttemptRepository(
            {
              ...mongoAttemptStore,
              async proof() {
                return null;
              },
            },
            undefined,
            completionGrading,
          );
          await assert.rejects(repository.submit(f.origin.userId, f.input));
          await f.submit();
          assert.equal(
            await db
              .collection('practiceAssessments')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            1,
          );
          // Deliberate proof-loss injection is not a real failover/uncertain-commit simulation.
        },
      );
      await t.test(
        'missing qualifying index refuses before attempt persistence',
        async () => {
          const f = await prepare();
          await f.approve();
          const index = gradingIndexes.find(
            (i) => i.collection === 'practiceAssessments',
          )!;
          await db
            .collection(index.collection)
            .dropIndex(index.name, { timeoutMS: 5000 });
          try {
            await assert.rejects(f.submit());
            assert.equal(
              await db.collection('practiceAttempts').countDocuments({
                userId: new Types.ObjectId(f.origin.userId),
              }),
              0,
            );
          } finally {
            await db.collection(index.collection).createIndex(index.key, {
              name: index.name,
              unique: true,
              timeoutMS: 5000,
            });
          }
        },
      );
      await t.test(
        'current STUDENT eligibility precedes the qualifying transaction',
        async () => {
          const f = await prepare();
          await f.approve();
          await assert.rejects(
            studentPractice.unlock(
              { sub: f.origin.userId, role: 'ADMIN' },
              f.input,
            ),
          );
          await db
            .collection('users')
            .updateOne(
              { _id: new Types.ObjectId(f.origin.userId) },
              { $set: { status: 'SUSPENDED' } },
            );
          await assert.rejects(f.submit());
          assert.equal(
            await db
              .collection('practiceAttempts')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'unpublished source and changed private solution refuse without partial persistence',
        async () => {
          const f = await prepare();
          await f.approve();
          const id = new Types.ObjectId(f.origin.questionId);
          await db
            .collection('practiceQuestions')
            .updateOne({ _id: id }, { $set: { status: 'DRAFT' } });
          await assert.rejects(f.submit());
          await db
            .collection('practiceQuestions')
            .updateOne(
              { _id: id },
              { $set: { status: 'PUBLISHED', answer: 'changed solution' } },
            );
          await assert.rejects(f.submit());
          assert.equal(
            await db
              .collection('practiceAttempts')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'a controlled prior ungraded disclosure cannot be retroactively qualified',
        async () => {
          const f = await prepare();
          // Deliberate test-only bypass of the qualification hook represents an
          // exposure-unknown historical path, not a production fallback.
          const ordinary = createPracticeAttemptRepository(
            mongoAttemptStore,
            undefined,
            null,
          );
          await ordinary.submit(f.origin.userId, f.input);
          await f.approve();
          await assert.rejects(f.submit());
          await f.submit({ idempotencyKey: randomUUID() });
          assert.equal(
            await db
              .collection('practiceAssessments')
              .countDocuments({ userId: new Types.ObjectId(f.origin.userId) }),
            0,
          );
        },
      );
      await t.test(
        'DIAGNOSTIC grading remains separate and unchanged during qualifying replay',
        async () => {
          const f = await prepare();
          await f.approve();
          const saved = await f.submit();
          const diagnostic = await rubricService.gradeDiagnostic(
            f.token,
            {
              attemptId: saved.attempt.id,
              rubricId: f.rubric.rubricId,
              rubricVersion: f.rubric.version,
            },
            'diagnostic',
          );
          const before = await db
            .collection('practiceAssessments')
            .findOne({ _id: new Types.ObjectId(diagnostic.id) });
          assert.equal(before!.purpose, 'DIAGNOSTIC');
          await f.submit();
          assert.deepEqual(
            await db
              .collection('practiceAssessments')
              .findOne({ _id: before!._id }),
            before,
          );
          assert.equal(
            await db.collection('practiceAssessments').countDocuments({
              userId: new Types.ObjectId(f.origin.userId),
              purpose: 'COMPLETION_INPUT',
            }),
            1,
          );
        },
      );
    } finally {
      try {
        if (verified && mongoose.connection.db)
          for (const name of owned)
            await mongoose.connection.db
              .collection(name)
              .drop({ timeoutMS: 5000 });
      } finally {
        await database.disconnect();
      }
      // External owner must gracefully shut down MongoDB and verify exit codes,
      // Job empty, port release, handles/storage disposal and protected baselines.
    }
  },
);
