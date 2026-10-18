import { performance } from 'node:perf_hooks';
import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  PracticeAttempt,
  attemptRecord,
  attemptIndexes,
  type AttemptRecord,
} from './practice-attempt.model.js';
import { practiceRepository } from './practice.repository.js';
import {
  attemptReceipt,
  sha256,
  type QualifiedPractice,
  type PracticeUnlockOutcome,
} from './practice.dto.js';
import {
  practiceUnlockRequest,
  idempotencyKey,
  type PracticeUnlockInput,
} from './practice.schema.js';

const unavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Practice submission unavailable',
  );
const unconfirmed = () =>
  new AppError(
    503,
    'PRACTICE_COMMIT_UNCONFIRMED',
    'Submission could not be confirmed; retry the unchanged request',
  );
const changed = () =>
  new AppError(
    409,
    'PRACTICE_QUESTION_CHANGED',
    'Question changed; refresh before submitting',
  );
const hidden = () =>
  new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
const conflict = () =>
  new AppError(
    409,
    'PRACTICE_IDEMPOTENCY_CONFLICT',
    'Submission key conflicts with this request',
  );
export function verifyAttemptIndexes(indexes: Record<string, unknown>[]) {
  for (const expected of attemptIndexes) {
    const actual = indexes.find((index) => index.name === expected.name);
    if (
      !actual ||
      JSON.stringify(actual.key) !== JSON.stringify(expected.key) ||
      Boolean(actual.unique) !== expected.unique ||
      actual.sparse ||
      actual.partialFilterExpression ||
      actual.hidden ||
      actual.expireAfterSeconds !== undefined ||
      (actual.collation &&
        JSON.stringify(actual.collation) !==
          JSON.stringify({ locale: 'simple' }))
    )
      throw unavailable();
  }
}
export interface AttemptStore {
  ready(timeoutMS: number): Promise<void>;
  session(): Promise<ClientSession>;
  qualified(
    questionId: string,
    conceptId: string,
    session: ClientSession,
    timeoutMS: number | undefined,
    majority: boolean,
  ): Promise<QualifiedPractice | null>;
  byKey(
    userId: Types.ObjectId,
    key: string,
    session: ClientSession,
  ): Promise<unknown>;
  last(
    userId: Types.ObjectId,
    questionId: Types.ObjectId,
    session: ClientSession,
  ): Promise<number>;
  insert(record: AttemptRecord, session: ClientSession): Promise<void>;
  proof(
    id: Types.ObjectId,
    userId: Types.ObjectId,
    key: string,
    session: ClientSession,
    timeoutMS: number,
  ): Promise<unknown>;
}
const projection = Object.fromEntries(
  Object.keys(attemptRecord.shape).map((key) => [key, 1]),
);
const collection = () => {
  if (!mongoose.connection.db) throw unavailable();
  return mongoose.connection.db.collection<AttemptRecord>('practiceAttempts');
};
const mongoStore: AttemptStore = {
  async ready(timeoutMS) {
    const db = mongoose.connection.db;
    if (!db) throw unavailable();
    const start = performance.now();
    const hello = await db.admin().command({ hello: 1 }, { timeoutMS });
    if (
      !hello.isWritablePrimary ||
      (!hello.setName && hello.msg !== 'isdbgrid') ||
      hello.logicalSessionTimeoutMinutes == null
    )
      throw unavailable();
    const remaining = Math.floor(timeoutMS - (performance.now() - start));
    if (remaining <= 0) throw unavailable();
    verifyAttemptIndexes(await collection().indexes({ timeoutMS: remaining }));
  },
  session: () => mongoose.connection.startSession({ causalConsistency: true }),
  qualified: (questionId, conceptId, session, timeoutMS, majority) =>
    practiceRepository.qualified(
      questionId,
      conceptId,
      session,
      timeoutMS,
      majority,
    ),
  byKey: (userId, key, session) =>
    collection().findOne(
      { userId, idempotencyKeyHash: key },
      { session, projection },
    ),
  async last(userId, questionId, session) {
    const row = await collection().findOne(
      { userId, questionId },
      {
        session,
        projection: { attemptNumber: 1 },
        sort: { attemptNumber: -1 },
        hint: 'uq_practice_attempt_sequence',
      },
    );
    return row?.attemptNumber ?? 0;
  },
  async insert(record, session) {
    await new PracticeAttempt(record).save({ session });
  },
  proof: (id, userId, key, session, timeoutMS) =>
    collection().findOne(
      { _id: id, userId, idempotencyKeyHash: key },
      {
        session,
        timeoutMS,
        projection,
        readPreference: 'primary',
        readConcern: { level: 'majority' },
      },
    ),
};
function knownDuplicate(error: unknown) {
  if (
    !error ||
    typeof error !== 'object' ||
    !('code' in error) ||
    error.code !== 11000 ||
    !('keyPattern' in error)
  )
    return false;
  return attemptIndexes
    .filter((index) => index.unique)
    .some(
      (index) => JSON.stringify(index.key) === JSON.stringify(error.keyPattern),
    );
}
function unknownCommit(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) return false;
  if (
    'errorLabels' in error &&
    Array.isArray(error.errorLabels) &&
    error.errorLabels.includes('UnknownTransactionCommitResult')
  )
    return true;
  return 'cause' in error && unknownCommit(error.cause, depth + 1);
}
export function createPracticeAttemptRepository(
  store: AttemptStore = mongoStore,
  clock = () => performance.now(),
) {
  return {
    async submit(
      userId: string,
      input: PracticeUnlockInput,
    ): Promise<PracticeUnlockOutcome> {
      // Defence in depth for callers other than the HTTP boundary.
      const parsed = practiceUnlockRequest.safeParse({
        params: { questionId: input.questionId },
        query: {},
        body: {
          conceptId: input.conceptId,
          studentAnswer: input.studentAnswer,
          questionRevision: input.questionRevision,
        },
      });
      if (
        !/^[a-f0-9]{24}(?![\s\S])/.test(userId) ||
        !parsed.success ||
        !idempotencyKey.safeParse(input.idempotencyKey).success
      )
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid submission');
      const started = clock(),
        remaining = () => {
          const value = Math.floor(10_000 - (clock() - started));
          if (value <= 0) throw unavailable();
          return value;
        };
      const owner = new Types.ObjectId(userId),
        question = new Types.ObjectId(input.questionId),
        concept = new Types.ObjectId(input.conceptId);
      const key = sha256(input.idempotencyKey);
      const request = sha256(
        JSON.stringify([
          'F036-request-v1',
          userId,
          input.questionId,
          input.conceptId,
          input.questionRevision,
          input.studentAnswer,
        ]),
      );
      const matches = (row: AttemptRecord) =>
        row.userId.equals(owner) &&
        row.questionId.equals(question) &&
        row.conceptId.equals(concept) &&
        row.idempotencyKeyHash === key &&
        row.requestFingerprint === request &&
        row.questionRevision === input.questionRevision &&
        row.studentAnswer === input.studentAnswer;
      let session: ClientSession | undefined;
      let bodies = 0,
        committed: AttemptRecord | undefined,
        commitReturned = false;
      let outcome: PracticeUnlockOutcome | undefined,
        failure: AppError | undefined;
      try {
        await store.ready(remaining());
        session = await store.session();
        while (!committed && bodies < 3) {
          const available = remaining() - 2000;
          if (available <= 0) throw unavailable();
          let candidate: AttemptRecord | undefined;
          try {
            await session.withTransaction(
              async () => {
                if (++bodies > 3 || remaining() <= 2000) throw unavailable();
                candidate = undefined;
                const content = await store.qualified(
                  input.questionId,
                  input.conceptId,
                  session!,
                  // Inherit withTransaction's bounded timeout; driver forbids overrides.
                  undefined,
                  false,
                );
                if (!content) throw hidden();
                const existing = await store.byKey(owner, key, session!);
                if (existing) {
                  const row = attemptRecord.parse(existing);
                  if (!matches(row)) throw conflict();
                  if (
                    content.questionRevision !== input.questionRevision ||
                    row.contentFingerprint !== content.contentFingerprint ||
                    row.type !== content.data.type
                  )
                    throw changed();
                  candidate = row;
                  return;
                }
                if (content.questionRevision !== input.questionRevision)
                  throw changed();
                const last = await store.last(owner, question, session!);
                if (
                  !Number.isSafeInteger(last) ||
                  last < 0 ||
                  last >= Number.MAX_SAFE_INTEGER
                )
                  throw unavailable();
                const row = attemptRecord.parse({
                  _id: new Types.ObjectId(),
                  userId: owner,
                  questionId: question,
                  conceptId: concept,
                  type: content.data.type,
                  questionRevision: input.questionRevision,
                  contentFingerprint: content.contentFingerprint,
                  attemptNumber: last + 1,
                  studentAnswer: input.studentAnswer,
                  submittedAt: new Date(),
                  result: 'SUBMITTED',
                  score: null,
                  idempotencyKeyHash: key,
                  requestFingerprint: request,
                  schemaVersion: 1,
                });
                await store.insert(row, session!);
                candidate = row;
              },
              {
                timeoutMS: available,
                maxCommitTimeMS: Math.min(2000, available),
                readConcern: { level: 'snapshot' },
                writeConcern: { w: 'majority', j: true },
                readPreference: 'primary',
              },
            );
            commitReturned = true;
            if (!candidate) throw unconfirmed();
            committed = candidate;
          } catch (error) {
            if (unknownCommit(error)) throw unconfirmed();
            if (knownDuplicate(error) && bodies < 3) continue;
            if (error instanceof AppError) throw error;
            throw candidate ? unconfirmed() : unavailable();
          }
        }
        if (!committed) throw unavailable();
        const proof = attemptRecord.safeParse(
          await store.proof(committed._id, owner, key, session, remaining()),
        );
        if (
          !proof.success ||
          !proof.data._id.equals(committed._id) ||
          !matches(proof.data) ||
          proof.data.attemptNumber !== committed.attemptNumber ||
          proof.data.contentFingerprint !== committed.contentFingerprint ||
          proof.data.type !== committed.type ||
          proof.data.submittedAt.getTime() !== committed.submittedAt.getTime()
        )
          throw unconfirmed();
        const current = await store.qualified(
          input.questionId,
          input.conceptId,
          session,
          remaining(),
          true,
        );
        if (!current) throw hidden();
        if (
          current.questionRevision !== proof.data.questionRevision ||
          current.contentFingerprint !== proof.data.contentFingerprint ||
          current.data.type !== proof.data.type ||
          current.data.id !== input.questionId ||
          current.data.conceptId !== input.conceptId
        )
          throw changed();
        outcome = { data: current.data, attempt: attemptReceipt(proof.data) };
      } catch (error) {
        failure =
          error instanceof AppError
            ? error
            : commitReturned
              ? unconfirmed()
              : unavailable();
      } finally {
        if (session) {
          try {
            await session.endSession();
          } catch {
            failure ??= unconfirmed();
            Object.defineProperty(failure, 'cleanupFailed', { value: true });
            outcome = undefined;
          }
        }
      }
      if (failure) throw failure;
      if (!outcome) throw unconfirmed();
      return outcome;
    },
  };
}
export const practiceAttemptRepository = createPracticeAttemptRepository();
export type PracticeAttemptRepository = ReturnType<
  typeof createPracticeAttemptRepository
>;
