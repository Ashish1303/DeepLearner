// PREPARED ONLY. Importing does not start tests, connect, provision or collect
// credentials. A separately approved retained-handle/Job supervisor must invoke
// this export with live assertOwned/onLoss/private-input implementations.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import {
  initializeCompletionStudentFixture,
  fixtureIndexes,
  parseFixtureCredentials,
  type SupervisedFixtureInitialization,
} from '../scripts/completion-student-fixture.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { createCompletionEvidenceService } from '../src/modules/progress/completion-evidence.service.js';
import { createMasteryService } from '../src/modules/progress/mastery.service.js';
import { mongoCompletionStore } from '../src/modules/progress/completion.repository.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
import {
  practiceDto,
  questionRevision,
} from '../src/modules/practice/practice.dto.js';
import { createVisualizationCheckpointService } from '../src/modules/visualizations/visualization-checkpoint.service.js';
import { Visualization } from '../src/modules/visualizations/visualization.model.js';
import { mongoQualification } from '../src/modules/progress/section-evidence.repository.js';

export const masteryIntegrationIndexes = fixtureIndexes;
const profile = {
  id: 'F039_DEFAULT_MASTERY',
  version: 1,
  improvingMinimum: 60,
  strongMinimum: 80,
};
const safeFailure = () => new Error('MASTERY_INTEGRATION_ABORTED');
// Observation only: never an authorization, assertion result or control channel.
export type MasteryLifecycleObserver = (
  stage: string,
  record: string,
  status: string,
  error?: unknown,
) => void;
export function createMasteryLifecycleObserver(
  observer?: MasteryLifecycleObserver,
): MasteryLifecycleObserver {
  return (stage, record, status, error) => {
    try {
      observer?.(stage, record, status, error);
    } catch {
      // Diagnostic failures cannot replace the original assertion or operation.
    }
  };
}
export async function observeMasteryOperation<T>(
  stage: 'FIXTURE_INITIALIZATION' | 'FIXTURE_CLEANUP',
  work: () => Promise<T>,
  observe: MasteryLifecycleObserver,
): Promise<T> {
  const note = createMasteryLifecycleObserver(observe);
  note(stage, 'PARENT', 'START');
  try {
    const value = await work();
    note(stage, 'PARENT', 'PASS');
    return value;
  } catch (error) {
    note(stage, 'PARENT', 'FAIL', error);
    throw error;
  }
}
export function runMasteryIntegration(
  initialization: SupervisedFixtureInitialization,
  observer?: MasteryLifecycleObserver,
) {
  const observe = createMasteryLifecycleObserver(observer);
  return test(
    'F039 guarded genuine original-assessment classification',
    { timeout: 180000 },
    async (t) => {
      observe('SUITE_ENTRY', 'PARENT', 'START');
      let fixture:
        | Awaited<ReturnType<typeof initializeCompletionStudentFixture>>
        | undefined;
      let origin:
        ReturnType<typeof createCompletionEvidenceService> | undefined;
      let secrets: ReturnType<typeof parseFixtureCredentials> | undefined;
      let unsubscribe: (() => void) | undefined;
      let supervisionLost = false;
      let authorToken = '',
        reviewerToken = '',
        studentToken = '',
        zeroToken = '';
      const endpoint = 'http://127.0.0.1:4000/api/v1';
      const post = (route: string, body: unknown, token = '', key?: string) =>
        fetch(endpoint + route, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'http://127.0.0.1:3000',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
            ...(key ? { 'Idempotency-Key': key } : {}),
          },
          body: JSON.stringify(body),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
      const login = async (email: string, password: string) => {
        const response = await post('/auth/login', { email, password });
        assert.equal(response.status, 200);
        return z
          .object({
            data: z.object({ accessToken: z.string().min(1).max(4096) }),
          })
          .parse(await response.json()).data.accessToken;
      };
      let recordOrdinal = 0;
      const stage = async (name: string, work: () => Promise<void>) => {
        const record = 'T0' + ++recordOrdinal;
        let failed = false;
        await t.test(name, async () => {
          observe('RECORD_BODY', record, 'START');
          try {
            await work();
            observe('RECORD_BODY', record, 'PASS');
          } catch (error) {
            observe('RECORD_BODY', record, 'FAIL', error);
            failed = true;
            throw safeFailure();
          }
        });
        if (failed) throw safeFailure();
      };
      try {
        fixture = await observeMasteryOperation(
          'FIXTURE_INITIALIZATION',
          () =>
            initializeCompletionStudentFixture({
              ...initialization,
              async readCredentials() {
                const parsed = parseFixtureCredentials(
                  await initialization.readCredentials(),
                );
                // Same private owner input, bounded to this fixture's setup; never return
                // these copies through result frames or retain them in assertion output.
                secrets = { ...parsed };
                return parsed;
              },
            }),
          observe,
        );
        unsubscribe = initialization.onLoss(() => {
          observe('INTEGRATION_ON_LOSS', 'PARENT', 'FAIL');
          supervisionLost = true;
          origin?.dispose();
          if (secrets) secrets.author = secrets.reviewer = secrets.student = '';
          secrets = undefined;
          authorToken = reviewerToken = studentToken = zeroToken = '';
        });
        const db = mongoose.connection.db!;
        await initialization.assertOwned();
        if (supervisionLost) throw safeFailure();
        const { env } = await import('../src/config/env.js');
        const tokens = createAccessTokens(env);
        const service = createMasteryService(tokens, env, profile);
        const firstConcept = fixture.conceptId;
        let secondConcept = '',
          secondQuestion = '';
        const signature = async () => {
          const hash = createHash('sha256');
          for (const collection of [
            'practiceAttempts',
            'practiceAssessments',
            'studentProgress',
            'completionRequests',
            'sectionEvidenceChallenges',
            'sectionActivityReceipts',
          ]) {
            const rows = await db
              .collection(collection)
              .find({}, { timeoutMS: 5000 })
              .sort({ _id: 1 })
              .toArray();
            hash.update(collection).update(JSON.stringify(rows));
          }
          return hash.digest('hex'); // Only compare hashes, never dump learner records.
        };
        await stage(
          'genuine independent Admin and Student login; missing score is not zero',
          async () => {
            assert(secrets);
            const conceptRow = await db
              .collection('concepts')
              .findOne(
                { _id: new Types.ObjectId(firstConcept) },
                { timeoutMS: 5000 },
              );
            assert(conceptRow);
            const rules = conceptRow.completionRules;
            // Canonical storage uses BSON references; locate the exact current policy.
            const policy = rules.versions.find(
              (p: { version: number }) => p.version === rules.activeVersion,
            );
            assert(policy);
            assert.notEqual(
              String(policy.authoredBy),
              String(policy.approvedBy),
            );
            const author = await db
              .collection('users')
              .findOne(
                { _id: policy.authoredBy },
                { projection: { email: 1 }, timeoutMS: 5000 },
              );
            const reviewer = await db
              .collection('users')
              .findOne(
                { _id: policy.approvedBy },
                { projection: { email: 1 }, timeoutMS: 5000 },
              );
            assert(author);
            assert(reviewer);
            authorToken = await login(author.email, secrets.author);
            reviewerToken = await login(reviewer.email, secrets.reviewer);
            studentToken = await login(fixture!.studentEmail, secrets.student);
            const authorClaims = await tokens.verify(authorToken),
              reviewerClaims = await tokens.verify(reviewerToken);
            assert.equal(authorClaims.role, 'ADMIN');
            assert.equal(reviewerClaims.role, 'ADMIN');
            assert.notEqual(authorClaims.sub, reviewerClaims.sub);
            assert.deepEqual(
              await service.classify({
                accessToken: studentToken,
                conceptId: firstConcept,
              }),
              { classification: 'UNCLASSIFIED', code: 'SCORE_MISSING' },
            );

            // A second independently server-created origin supplies a genuine score
            // zero without rewriting the first student's immutable assessment.
            origin = createCompletionEvidenceService(
              tokens,
              env,
              undefined,
              undefined,
              async () => {
                await initialization.assertOwned();
                if (supervisionLost || !secrets) throw safeFailure();
                return secrets.student;
              },
            );
            if (supervisionLost) {
              origin.dispose();
              throw safeFailure();
            }
            const created = await origin.create(authorToken, {
              topicId: String(conceptRow.topicId),
              summary: 'A synthetic literal stays unchanged.',
              bodyMarkdown: 'The literal value is unchanged.',
              example: 'The literal expression `1` produces `1`.',
              prompt: 'What is the output of the literal expression `1`?',
              answer: '1',
            });
            secondConcept = created.conceptId;
            secondQuestion = created.questionId;
            const visualization = await new Visualization({
              conceptId: new Types.ObjectId(secondConcept),
              topicId: conceptRow.topicId,
              technologyId: conceptRow.technologyId,
              status: 'PUBLISHED',
              type: 'ANIMATED_FLOW',
              schemaVersion: 1,
              title: 'Unchanged value',
              textAlternative: 'One unchanged node; animation is unnecessary.',
              nodes: [{ id: 'value', label: 'Unchanged value' }],
              edges: [],
              steps: [
                {
                  title: 'Observe',
                  explanation: 'The value remains.',
                  nodeIds: ['value'],
                  edgeIds: [],
                },
              ],
              createdBy: authorClaims.sub,
              updatedBy: authorClaims.sub,
            }).save();
            const visual = createVisualizationCheckpointService(tokens, env);
            const definition = await visual.author(
              authorToken,
              {
                conceptId: secondConcept,
                visualizationId: visualization.id,
                checkpointId: 'value',
                checkpointVersion: 1,
                prompt: 'Which node is present?',
                textAlternative: 'One node labelled Unchanged value.',
                choices: [
                  { id: 'value', label: 'Unchanged value' },
                  { id: 'other', label: 'Another node' },
                ],
                expectedChoiceId: 'value',
              },
              randomUUID(),
            );
            await visual.approve(
              reviewerToken,
              { definitionId: definition.id },
              randomUUID(),
            );
            const question = await practiceRepository.qualified(
              secondQuestion,
              secondConcept,
            );
            assert(question);
            const grading = createPracticeGradingService(tokens, env);
            const rubric = await grading.author(
              authorToken,
              {
                questionId: secondQuestion,
                conceptId: secondConcept,
                questionRevision: question.questionRevision,
                type: 'OUTPUT',
                answerForm: 'TEXT',
                comparison: 'EXACT_TEXT',
                normalization: 'NONE',
                expectedAnswer: '1',
              },
              randomUUID(),
            );
            await grading.approve(
              reviewerToken,
              { rubricId: rubric.rubricId, version: rubric.version },
              randomUUID(),
            );
            const policy2 = await origin.author(authorToken, {
              conceptId: secondConcept,
              rubricId: rubric.rubricId,
              rubricVersion: rubric.version,
              checkpointDefinitionId: definition.id,
              minimumScore: 70,
            });
            await origin.approve(reviewerToken, {
              conceptId: secondConcept,
              version: policy2.version,
            });
            zeroToken = await login(
              'synthetic-' + created.userId + '@example.invalid',
              secrets.student,
            );
            secrets.author = secrets.reviewer = secrets.student = '';
            secrets = undefined;
          },
        );
        await stage(
          'cross-account, Admin and invalid access cannot obtain a classification',
          async () => {
            for (const command of [
              { accessToken: studentToken, conceptId: secondConcept },
              { accessToken: zeroToken, conceptId: firstConcept },
              { accessToken: authorToken, conceptId: firstConcept },
              { accessToken: 'invalid', conceptId: firstConcept },
            ])
              await assert.rejects(
                service.classify(command),
                (e: unknown) =>
                  e instanceof AppError &&
                  [401, 403, 404].includes(e.statusCode),
              );
          },
        );
        await stage(
          'genuine original OUTPUT submissions yield 100/STRONG and 0/WEAK',
          async () => {
            for (const [conceptId, token, answer, classification] of [
              [firstConcept, studentToken, '1', 'STRONG'],
              [secondConcept, zeroToken, '2', 'WEAK'],
            ] as const) {
              const response = await fetch(
                endpoint +
                  '/practice-questions?conceptId=' +
                  conceptId +
                  '&type=OUTPUT&page=1&limit=10',
                {
                  headers: { Authorization: 'Bearer ' + token },
                  signal: AbortSignal.timeout(15000),
                },
              );
              assert.equal(response.status, 200);
              const items = z
                .object({ data: z.array(z.record(z.string(), z.unknown())) })
                .parse(await response.json()).data;
              assert.equal(items.length, 1);
              const dto = practiceDto({ ...items[0], _id: items[0]!.id });
              const submitted = await post(
                '/practice-questions/' + dto.id + '/unlock',
                {
                  conceptId,
                  questionRevision: questionRevision(dto),
                  studentAnswer: answer,
                },
                token,
                randomUUID(),
              );
              assert.equal(submitted.status, 200); // Existing path authorizes disclosure only after durable proof.
              assert.deepEqual(
                await service.classify({ accessToken: token, conceptId }),
                { classification, code: 'NONE' },
              );
            }
            assert.equal(
              await db
                .collection('practiceAttempts')
                .countDocuments({}, { timeoutMS: 5000 }),
              2,
            );
            assert.equal(
              await db
                .collection('practiceAssessments')
                .countDocuments(
                  { purpose: 'COMPLETION_INPUT' },
                  { timeoutMS: 5000 },
                ),
              2,
            );
          },
        );
        await stage(
          'concurrent/read replay is private and leaves attempts, progress and receipts unchanged',
          async () => {
            const before = await signature();
            const results = await Promise.all(
              Array.from({ length: 3 }, () =>
                service.classify({
                  accessToken: studentToken,
                  conceptId: firstConcept,
                }),
              ),
            );
            for (const result of results)
              assert.deepEqual(result, {
                classification: 'STRONG',
                code: 'NONE',
              });
            assert.equal(await signature(), before);
          },
        );
        await stage(
          'controlled majority proof loss refuses; this is not real failover',
          async () => {
            const reader = createMasteryService(tokens, env, profile, {
              ...mongoCompletionStore,
              async sources(scope, read, fence) {
                if (read.majority) throw new Error('PROOF_UNAVAILABLE');
                return mongoCompletionStore.sources(scope, read, fence);
              },
            });
            await assert.rejects(
              reader.classify({
                accessToken: studentToken,
                conceptId: firstConcept,
              }),
              (e: unknown) => e instanceof AppError && e.statusCode === 503,
            );
          },
        );
        await stage(
          'terminal reviewed policy revocation refuses the original zero score',
          async () => {
            assert(origin);
            await origin.revoke(reviewerToken, {
              conceptId: secondConcept,
              version: 1,
            });
            assert.deepEqual(
              await service.classify({
                accessToken: zeroToken,
                conceptId: secondConcept,
              }),
              { classification: 'UNCLASSIFIED', code: 'REVOKED_ASSESSMENT' },
            );
          },
        );
        await stage(
          'content revision drift and unpublished ancestry cannot retain a label',
          async () => {
            const revisionBefore = await mongoQualification.conceptRevision(
              firstConcept,
              { majority: true, timeoutMS: 5000 },
            );
            const changed = await db
              .collection('concepts')
              .updateOne(
                { _id: new Types.ObjectId(firstConcept) },
                { $set: { 'read.summary': 'Changed synthetic revision' } },
                { timeoutMS: 5000 },
              );
            assert.equal(changed.matchedCount, 1);
            assert.equal(changed.modifiedCount, 1);
            const revisionAfter = await mongoQualification.conceptRevision(
              firstConcept,
              { majority: true, timeoutMS: 5000 },
            );
            assert.notEqual(revisionAfter, revisionBefore);
            assert.deepEqual(
              await service.classify({
                accessToken: studentToken,
                conceptId: firstConcept,
              }),
              { classification: 'UNCLASSIFIED', code: 'STALE_ASSESSMENT' },
            );
            await db
              .collection('concepts')
              .updateOne(
                { _id: new Types.ObjectId(firstConcept) },
                { $set: { status: 'DRAFT' } },
                { timeoutMS: 5000 },
              );
            await assert.rejects(
              service.classify({
                accessToken: studentToken,
                conceptId: firstConcept,
              }),
              (e: unknown) => e instanceof AppError && e.statusCode === 404,
            );
          },
        );
        await stage(
          'connection loss permanently refuses authority without reconstruction',
          async () => {
            await mongoose.disconnect();
            await assert.rejects(
              service.classify({
                accessToken: zeroToken,
                conceptId: secondConcept,
              }),
              (e: unknown) =>
                e instanceof AppError && [404, 503].includes(e.statusCode),
            );
          },
        );
        observe('SUITE_BODY', 'PARENT', 'PASS');
      } catch (error) {
        observe('SUITE_BODY', 'PARENT', 'FAIL', error);
        throw error;
      } finally {
        observe('CLEANUP_ENTRY', 'PARENT', 'START');
        if (secrets) secrets.author = secrets.reviewer = secrets.student = '';
        secrets = undefined;
        authorToken = reviewerToken = studentToken = zeroToken = '';
        origin?.dispose();
        unsubscribe?.();
        await observeMasteryOperation(
          'FIXTURE_CLEANUP',
          async () => {
            await fixture?.stopResources();
          },
          observe,
        );
        // External supervisor alone owns mongod shutdown/Job/handle/storage disposal.
      }
    },
  );
}
