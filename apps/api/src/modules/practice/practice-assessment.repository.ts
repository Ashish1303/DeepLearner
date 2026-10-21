import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { attemptRecord, type AttemptRecord } from './practice-attempt.model.js';
import { practiceRepository } from './practice.repository.js';
import type { QualifiedPractice } from './practice.dto.js';
import {
  PracticeAssessment,
  assessmentRecord,
  assessmentIndex,
  type AssessmentRecord,
  completionAssessmentRecord,
  type CompletionAssessmentRecord,
} from './practice-assessment.model.js';
import { rubricIndexes } from './practice-rubric.model.js';
import {
  mongoRubrics,
  gradingDatabase,
  gradingOptions,
  gradingWriteSession,
  gradingUnavailable,
  GradingWriteConflict,
  type GradingRead,
  type RubricStore,
} from './practice-rubric.repository.js';

export const unconfirmedAssessment = () =>
  new AppError(
    503,
    'PRACTICE_ASSESSMENT_UNCONFIRMED',
    'Diagnostic outcome could not be confirmed',
  );
export const gradingIndexes = [...rubricIndexes, assessmentIndex];
export function verifyGradingIndex(
  indexes: Record<string, unknown>[],
  expected: (typeof gradingIndexes)[number],
) {
  const row = indexes.find((i) => i.name === expected.name);
  if (
    !row ||
    JSON.stringify(row.key) !== JSON.stringify(expected.key) ||
    row.unique !== true ||
    row.v !== 2 ||
    Object.keys(row).some((k) => !['v', 'key', 'name', 'unique'].includes(k))
  )
    throw gradingUnavailable();
}
export const assessmentIdentity = (
  r: Pick<
    AssessmentRecord,
    | 'userId'
    | 'attemptId'
    | 'rubricId'
    | 'rubricVersion'
    | 'graderId'
    | 'graderVersion'
  >,
) => ({
  userId: r.userId,
  attemptId: r.attemptId,
  rubricId: r.rubricId,
  rubricVersion: r.rubricVersion,
  graderId: r.graderId,
  graderVersion: r.graderVersion,
});
export interface GradingStore extends RubricStore {
  ready(timeoutMS: number): Promise<void>;
  session(): Promise<ClientSession>;
  attempt(
    id: Types.ObjectId,
    owner: Types.ObjectId,
    read: GradingRead,
  ): Promise<AttemptRecord | null>;
  qualified(
    question: string,
    concept: string,
    read: GradingRead,
  ): Promise<QualifiedPractice | null>;
  assessment(
    identity: ReturnType<typeof assessmentIdentity>,
    read: GradingRead,
  ): Promise<AssessmentRecord | null>;
  assessmentProof(
    id: Types.ObjectId,
    owner: Types.ObjectId,
    read: GradingRead,
  ): Promise<AssessmentRecord | null>;
  insertAssessment(row: AssessmentRecord, read: GradingRead): Promise<void>;
}
const assessments = () =>
  gradingDatabase().collection<AssessmentRecord>('practiceAssessments');
const assessmentProjection = Object.fromEntries(
  Object.keys(PracticeAssessment.schema.paths).map((k) => [k, 1]),
);
export const mongoGrading: GradingStore = {
  ...mongoRubrics,
  async ready(timeoutMS) {
    const started = performance.now(),
      remaining = () => {
        const ms = Math.floor(timeoutMS - (performance.now() - started));
        if (ms <= 0) throw gradingUnavailable();
        return ms;
      };
    const hello = await gradingDatabase()
      .admin()
      .command({ hello: 1 }, { timeoutMS: remaining() });
    if (
      !hello.isWritablePrimary ||
      (!hello.setName && hello.msg !== 'isdbgrid') ||
      hello.logicalSessionTimeoutMinutes == null
    )
      throw gradingUnavailable();
    for (const expected of gradingIndexes)
      verifyGradingIndex(
        await gradingDatabase()
          .collection(expected.collection)
          .indexes({ timeoutMS: remaining() }),
        expected,
      );
  },
  session: () => mongoose.connection.startSession({ causalConsistency: true }),
  async attempt(id, owner, read) {
    const row = await gradingDatabase()
      .collection('practiceAttempts')
      .findOne(
        { _id: id, userId: owner },
        {
          ...gradingOptions(read),
          projection: Object.fromEntries(
            Object.keys(attemptRecord.shape).map((k) => [k, 1]),
          ),
        },
      );
    return row ? attemptRecord.parse(row) : null;
  },
  qualified: (question, concept, read) =>
    practiceRepository.qualified(
      question,
      concept,
      read.session,
      read.timeoutMS,
      read.majority,
    ),
  async assessment(identity, read) {
    const row = await assessments().findOne(identity, {
      ...gradingOptions(read),
      projection: assessmentProjection,
    });
    return row ? assessmentRecord.parse(row) : null;
  },
  async assessmentProof(id, owner, read) {
    const row = await assessments().findOne(
      { _id: id, userId: owner },
      { ...gradingOptions(read), projection: assessmentProjection },
    );
    return row ? assessmentRecord.parse(row) : null;
  },
  async insertAssessment(row, read) {
    await new PracticeAssessment(row).save({
      session: gradingWriteSession(read),
    });
  },
};
/** Distinct first-submission branch: never consumed by the diagnostic service. */
export const completionAssessments = {
  ready: (ms: number) => mongoGrading.ready(ms),
  async find(
    attempt: AttemptRecord,
    read: GradingRead,
  ): Promise<CompletionAssessmentRecord | null> {
    const row = await gradingDatabase()
      .collection('practiceAssessments')
      .findOne(
        {
          userId: attempt.userId,
          attemptId: attempt._id,
          graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
          graderVersion: 1,
          purpose: 'COMPLETION_INPUT',
          schemaVersion: 2,
        },
        gradingOptions(read),
      );
    return row ? completionAssessmentRecord.parse(row) : null;
  },
  async insert(row: CompletionAssessmentRecord, read: GradingRead) {
    await new PracticeAssessment(completionAssessmentRecord.parse(row)).save({
      session: gradingWriteSession(read),
    });
  },
};
function unknownCommit(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) return false;
  return (
    ('errorLabels' in error &&
      Array.isArray(error.errorLabels) &&
      error.errorLabels.includes('UnknownTransactionCommitResult')) ||
    ('cause' in error && unknownCommit(error.cause, depth + 1))
  );
}
function retryable(error: unknown) {
  if (error instanceof GradingWriteConflict) return true;
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 11000 &&
    'keyPattern' in error &&
    (JSON.stringify(error.keyPattern) === JSON.stringify({ _id: 1 }) ||
      gradingIndexes.some(
        (i) => JSON.stringify(i.key) === JSON.stringify(error.keyPattern),
      ))
  );
}
/** Owns only B2 transactions. Existing attempt/progress writers are never called. */
export function createGradingRepository(
  store: GradingStore = mongoGrading,
  clock = () => performance.now(),
) {
  return {
    store,
    async transact<T>(
      work: (read: GradingRead) => Promise<T>,
      prove: (value: T, read: GradingRead) => Promise<void>,
      before?: (read: GradingRead) => Promise<void>,
    ): Promise<T> {
      const started = clock(),
        remaining = () => {
          const ms = Math.floor(10_000 - (clock() - started));
          if (ms <= 0) throw gradingUnavailable();
          return ms;
        };
      let session: ClientSession | undefined,
        candidate: T | undefined,
        committed = false,
        failure: AppError | undefined;
      let bodies = 0;
      try {
        await store.ready(remaining());
        session = await store.session();
        const proofRead: GradingRead = {
          session,
          get timeoutMS() {
            return remaining();
          },
          majority: true,
        };
        await before?.(proofRead);
        while (!committed && bodies < 3) {
          const budget = remaining() - 2000;
          if (budget <= 0) throw gradingUnavailable();
          try {
            await session.withTransaction(
              async () => {
                if (++bodies > 3 || remaining() <= 2000)
                  throw gradingUnavailable();
                candidate = undefined;
                candidate = await work({ session: session! });
              },
              {
                timeoutMS: budget,
                maxCommitTimeMS: Math.min(2000, budget),
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority', j: true },
                readPreference: 'primary',
              },
            );
            committed = true;
          } catch (error) {
            if (unknownCommit(error)) throw unconfirmedAssessment();
            if (retryable(error) && bodies < 3) continue;
            throw error;
          }
        }
        if (!committed || candidate === undefined)
          throw unconfirmedAssessment();
        await prove(candidate, proofRead);
      } catch (error) {
        failure =
          error instanceof AppError
            ? error
            : committed
              ? unconfirmedAssessment()
              : gradingUnavailable();
      } finally {
        if (session)
          try {
            await session.endSession();
          } catch {
            failure ??= unconfirmedAssessment();
          }
      }
      if (failure) throw failure;
      if (candidate === undefined) throw unconfirmedAssessment();
      return candidate;
    },
  };
}
export type GradingRepository = ReturnType<typeof createGradingRepository>;
