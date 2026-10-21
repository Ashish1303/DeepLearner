// PREPARED ONLY: never included in *.test.ts. Requires separate owner execution
// approval and an external retained-handle/Job-owned disposable MongoDB launcher.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createDatabase, mongoose } from '../src/config/database.js';
import { User } from '../src/modules/users/user.model.js';
import { Technology } from '../src/modules/technologies/technology.model.js';
import { LearningPath } from '../src/modules/learning-paths/learning-path.model.js';
import { Module } from '../src/modules/modules/module.model.js';
import { Topic } from '../src/modules/topics/topic.model.js';
import { Concept } from '../src/modules/concepts/concept.model.js';
import { PracticeQuestion } from '../src/modules/practice/practice-question.model.js';
import { PracticeAttempt } from '../src/modules/practice/practice-attempt.model.js';
import { StudentProgress } from '../src/modules/progress/progress.model.js';
import { Audit } from '../src/modules/audit/audit.model.js';
import {
  PracticeRubricVersion,
  PracticeRubricAuthority,
} from '../src/modules/practice/practice-rubric.model.js';
import {
  PracticeAssessment,
  assessmentIndex,
} from '../src/modules/practice/practice-assessment.model.js';
import { practiceRepository } from '../src/modules/practice/practice.repository.js';
import { practiceAttemptRepository } from '../src/modules/practice/practice-attempt.repository.js';
import {
  createGradingRepository,
  mongoGrading,
} from '../src/modules/practice/practice-assessment.repository.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';

test(
  'F038 B2 disposable rubric authorization and diagnostic assessment integration',
  { timeout: 90_000 },
  async (t) => {
    assert.equal(process.env.APP_ENV, 'LOCAL');
    assert.equal(process.env.F021_TEST_ALLOW_WRITES, 'APPROVED');
    assert.equal(
      process.env.F021_TEST_URI,
      'mongodb://127.0.0.1:27018/?replicaSet=f021-test',
    );
    assert.equal(process.env.F021_TEST_DB, 'deeplearner-f021-test');
    // Before invoking this entry point, the separately approved launcher must verify
    // unelevated identity, fresh storage/native handle/executable/owner/parent/Job,
    // microsecond time identity, protected baselines and exclusive port ownership.
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
    let verifiedTarget = false;
    const failures: unknown[] = [];
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
      assert.deepEqual(await db.listCollections().toArray(), []);
      verifiedTarget = true;
      // Heterogeneous models share only this explicit collection-creation surface.
      const models: {
        collection: { name: string };
        createCollection(): Promise<unknown>;
      }[] = [
        User,
        Technology,
        LearningPath,
        Module,
        Topic,
        Concept,
        PracticeQuestion,
        PracticeAttempt,
        StudentProgress,
        Audit,
        PracticeRubricVersion,
        PracticeRubricAuthority,
        PracticeAssessment,
      ];
      for (const model of models) {
        await model.createCollection();
        owned.unshift(model.collection.name);
      }
      // Provision only approved definitions inside this verified disposable target.
      await PracticeAttempt.createIndexes();
      await StudentProgress.createIndexes();
      await Audit.createIndexes();
      await PracticeRubricVersion.createIndexes();
      await PracticeRubricAuthority.createIndexes();
      await PracticeAssessment.createIndexes();
      const account = (name: string, role: 'ADMIN' | 'STUDENT') =>
        User.create({
          email: `${name}@example.invalid`,
          firstName: 'Synthetic',
          lastName: name,
          authProviders: [
            { provider: 'GOOGLE', providerUserId: 'f038-b2-' + name },
          ],
          role,
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        });
      const author = await account('author', 'ADMIN'),
        reviewer = await account('reviewer', 'ADMIN'),
        student = await account('student', 'STUDENT');
      const provenance = {
        createdBy: author._id,
        updatedBy: author._id,
        status: 'PUBLISHED' as const,
      };
      const tech = await Technology.create({
        ...provenance,
        name: 'Synthetic',
        slug: 'b2-tech',
      });
      const path = await LearningPath.create({
        ...provenance,
        technologyId: tech._id,
        title: 'Synthetic',
        slug: 'b2-path',
      });
      const module = await Module.create({
        technologyId: tech._id,
        learningPathId: path._id,
        title: 'Synthetic',
        slug: 'b2-module',
        status: 'PUBLISHED',
      });
      const topic = await Topic.create({
        technologyId: tech._id,
        learningPathId: path._id,
        moduleId: module._id,
        title: 'Synthetic',
        slug: 'b2-topic',
        status: 'PUBLISHED',
      });
      const concept = await Concept.create({
        ...provenance,
        technologyId: tech._id,
        learningPathId: path._id,
        moduleId: module._id,
        topicId: topic._id,
        title: 'Synthetic',
        slug: 'b2-concept',
        difficulty: 'BEGINNER',
        read: { summary: 'Synthetic', bodyMarkdown: 'Synthetic' },
        source: {
          label: 'Synthetic',
          url: 'https://example.invalid',
          sourceType: 'OFFICIAL_OR_TRUSTED',
          isOfficial: false,
        },
      });
      const question = await new PracticeQuestion({
        ...provenance,
        technologyId: tech._id,
        topicId: topic._id,
        conceptId: concept._id,
        type: 'OUTPUT',
        difficulty: 'BEGINNER',
        prompt: 'Synthetic deterministic output',
        answer: '42',
        explanation: 'SYNTHETIC_ONLY',
      }).save();
      const content = (await practiceRepository.qualified(
        question.id,
        concept.id,
      ))!;
      const tokens = createAccessTokens({
        ACCESS_TOKEN_SECRET: Buffer.alloc(32, 13).toString('base64'),
        ACCESS_TOKEN_ISSUER: 'integration',
        ACCESS_TOKEN_AUDIENCE: 'integration',
      });
      const token = (id: string, role: 'ADMIN' | 'STUDENT') =>
        tokens.sign({ sub: id, role, sid: 'f'.repeat(24), plan: 'FREE' });
      const authorToken = await token(author.id, 'ADMIN'),
        reviewerToken = await token(reviewer.id, 'ADMIN'),
        studentToken = await token(student.id, 'STUDENT');
      const service = createPracticeGradingService(tokens, {
        APP_ENV: 'LOCAL',
      });
      const draft = {
        questionId: question.id,
        conceptId: concept.id,
        questionRevision: content.questionRevision,
        type: 'OUTPUT',
        answerForm: 'TEXT',
        comparison: 'EXACT_TEXT',
        normalization: 'NONE',
        expectedAnswer: '42',
      };
      const d = await service.author(authorToken, draft, 'draft-1');
      const version = { rubricId: d.rubricId, version: d.version };
      const expectCode = (work: Promise<unknown>, code: string) =>
        assert.rejects(work, (e) => e instanceof AppError && e.code === code);
      const persisted = await practiceAttemptRepository.submit(student.id, {
        questionId: question.id,
        conceptId: concept.id,
        studentAnswer: '42',
        questionRevision: content.questionRevision,
        idempotencyKey: randomUUID(),
      });
      const input = {
        attemptId: persisted.attempt.id,
        rubricId: d.rubricId,
        rubricVersion: d.version,
      };
      const baselineAttempts = JSON.stringify(
        await db.collection('practiceAttempts').find().toArray(),
      );
      const baselineProgress = JSON.stringify(
        await db.collection('studentProgress').find().toArray(),
      );

      await t.test(
        'independent real Admin review and transactional audit provenance',
        async () => {
          await expectCode(
            service.approve(authorToken, version, 'self'),
            'AUTH_FORBIDDEN',
          );
          assert.equal(
            await db.collection('practiceRubricAuthorities').countDocuments(),
            0,
          );
          await service.approve(reviewerToken, version, 'approve-1');
          assert.equal(
            await db
              .collection('auditLogs')
              .countDocuments({ category: 'CONTENT_APPROVAL' }),
            2,
          );
        },
      );
      await t.test(
        'missing and incorrect unique assessment indexes refuse live without results',
        async () => {
          const target = db.collection('practiceAssessments');
          await target.dropIndex(assessmentIndex.name);
          try {
            await expectCode(
              service.gradeDiagnostic(studentToken, input, 'missing-index'),
              'DEPENDENCY_UNAVAILABLE',
            );
            await target.createIndex(assessmentIndex.key, {
              name: assessmentIndex.name,
              unique: false,
            });
            await expectCode(
              service.gradeDiagnostic(studentToken, input, 'incorrect-index'),
              'DEPENDENCY_UNAVAILABLE',
            );
          } finally {
            const indexes = await target.indexes();
            if (indexes.some((i) => i.name === assessmentIndex.name))
              await target.dropIndex(assessmentIndex.name);
            await target.createIndex(assessmentIndex.key, {
              name: assessmentIndex.name,
              unique: true,
            });
          }
          assert.equal(await target.countDocuments(), 0);
        },
      );
      await t.test(
        'current reviewer status is checked against actual stored account',
        async () => {
          await User.collection.updateOne(
            { _id: reviewer._id },
            { $set: { status: 'DISABLED' } },
          );
          try {
            await expectCode(
              service.gradeDiagnostic(studentToken, input, 'disabled'),
              'AUTH_FORBIDDEN',
            );
          } finally {
            await User.collection.updateOne(
              { _id: reviewer._id },
              { $set: { status: 'ACTIVE' } },
            );
          }
        },
      );
      await t.test(
        'owned majority attempt grades once and does not mutate attempts or activity',
        async () => {
          const result = await service.gradeDiagnostic(
            studentToken,
            input,
            'grade-1',
          );
          assert.equal(result.score, 100);
          assert.equal(result.purpose, 'DIAGNOSTIC');
          assert.equal('answer' in result, false);
          assert.equal('expectedAnswer' in result, false);
          assert.equal(
            JSON.stringify(
              await db.collection('practiceAttempts').find().toArray(),
            ),
            baselineAttempts,
          );
          assert.equal(
            JSON.stringify(
              await db.collection('studentProgress').find().toArray(),
            ),
            baselineProgress,
          );
        },
      );
      await t.test(
        'concurrent same-identity replay retains one record and one evaluation time',
        async () => {
          const rows = await Promise.all([
            service.gradeDiagnostic(studentToken, input, 'same-a'),
            service.gradeDiagnostic(studentToken, input, 'same-b'),
          ]);
          assert.deepEqual(rows[0], rows[1]);
          assert.equal(
            await db.collection('practiceAssessments').countDocuments(),
            1,
          );
        },
      );
      await t.test(
        'fresh publication and solution binding prevent stale replay',
        async () => {
          await PracticeQuestion.collection.updateOne(
            { _id: question._id },
            { $set: { status: 'DRAFT' } },
          );
          try {
            await expectCode(
              service.gradeDiagnostic(studentToken, input, 'hidden'),
              'CONCEPT_NOT_FOUND',
            );
          } finally {
            await PracticeQuestion.collection.updateOne(
              { _id: question._id },
              { $set: { status: 'PUBLISHED' } },
            );
          }
          await PracticeQuestion.collection.updateOne(
            { _id: question._id },
            { $set: { answer: 'changed' } },
          );
          try {
            await expectCode(
              service.gradeDiagnostic(studentToken, input, 'changed'),
              'PRACTICE_ASSESSMENT_CONFLICT',
            );
          } finally {
            await PracticeQuestion.collection.updateOne(
              { _id: question._id },
              { $set: { answer: '42' } },
            );
          }
        },
      );
      await t.test('missing required approval audit fails closed', async () => {
        const audit = await db
          .collection('auditLogs')
          .findOne({ action: 'PRACTICE_RUBRIC_APPROVED' });
        assert(audit);
        await db.collection('auditLogs').deleteOne({ _id: audit._id });
        try {
          await expectCode(
            service.gradeDiagnostic(studentToken, input, 'audit-missing'),
            'DEPENDENCY_UNAVAILABLE',
          );
        } finally {
          await db.collection('auditLogs').insertOne(audit);
        }
      });
      await t.test(
        'required audit fault rolls back an actual draft transaction',
        async () => {
          const count = await db
            .collection('practiceRubricVersions')
            .countDocuments();
          const faulty = createPracticeGradingService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createGradingRepository({
              ...mongoGrading,
              async audit() {
                throw Error('SYNTHETIC_AUDIT_FAULT');
              },
            }),
          );
          await expectCode(
            faulty.author(authorToken, draft, 'rollback-draft'),
            'DEPENDENCY_UNAVAILABLE',
          );
          assert.equal(
            await db.collection('practiceRubricVersions').countDocuments(),
            count,
          );
        },
      );
      await t.test(
        'postcommit proof-loss injection refuses; explicit identity resolves once',
        async () => {
          const faulty = createPracticeGradingService(
            tokens,
            { APP_ENV: 'LOCAL' },
            createGradingRepository({
              ...mongoGrading,
              async assessmentProof() {
                return null;
              },
            }),
          );
          await expectCode(
            faulty.gradeDiagnostic(studentToken, input, 'proof-loss'),
            'PRACTICE_ASSESSMENT_UNCONFIRMED',
          );
          assert.equal(
            (await service.gradeDiagnostic(studentToken, input, 'resolve'))
              .score,
            100,
          );
          assert.equal(
            await db.collection('practiceAssessments').countDocuments(),
            1,
          );
          // This is a controlled proof fault, NOT a live unknown-driver-commit claim.
        },
      );
      await t.test(
        'shared-document grade/revoke race leaves only diagnostic history and blocks fresh replay',
        async () => {
          await Promise.allSettled([
            service.gradeDiagnostic(studentToken, input, 'race-grade'),
            service.revoke(authorToken, version, 'race-revoke'),
          ]);
          const authority = await db
            .collection('practiceRubricAuthorities')
            .findOne({ version: d.version });
          assert.equal(authority?.state, 'REVOKED');
          await expectCode(
            service.gradeDiagnostic(studentToken, input, 'after-revoke'),
            'AUTH_FORBIDDEN',
          );
          assert.equal(
            await db.collection('practiceAssessments').countDocuments(),
            1,
          );
          assert.equal(
            await db
              .collection('auditLogs')
              .countDocuments({ action: 'PRACTICE_RUBRIC_REVOKED' }),
            1,
          );
          assert.equal(
            JSON.stringify(
              await db.collection('practiceAttempts').find().toArray(),
            ),
            baselineAttempts,
          );
          assert.equal(
            JSON.stringify(
              await db.collection('studentProgress').find().toArray(),
            ),
            baselineProgress,
          );
        },
      );
    } catch (error) {
      failures.push(error);
    } finally {
      if (
        verifiedTarget &&
        mongoose.connection.db?.databaseName === 'deeplearner-f021-test'
      ) {
        for (const collection of owned)
          try {
            await mongoose.connection.db.dropCollection(collection, {
              timeoutMS: 5000,
            });
          } catch {
            failures.push(new Error('Owned collection cleanup failed'));
          }
      }
      try {
        await database.disconnect();
      } catch {
        failures.push(new Error('Connection cleanup failed'));
      }
      // External owned launcher handles graceful process/Job/port/storage cleanup.
    }
    if (failures.length)
      throw new AggregateError(failures, 'Disposable gate or cleanup failed');
  },
);
