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
  completionGrading,
  type CompletionGrading,
} from './completion-grading.service.js';
import { GradingWriteConflict } from './practice-rubric.repository.js';
import { mongoQualification } from '../progress/section-evidence.repository.js';
import {
  progressRepository,
  ProgressWriteConflict,
  type ProgressBaseline,
} from '../progress/progress.repository.js';
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
interface CoordinationPermit {
  readonly replayOnly: boolean;
  assert(): void;
  finish(success: boolean): void;
}
interface CoordinationSource {
  local(): boolean;
  generation(): { client: object; database: object; live: boolean };
  onLoss(invalidate: () => void): () => void;
}
interface CoordinationWaiter {
  remaining(): number;
  resolve(permit: CoordinationPermit): void;
  reject(error: AppError): void;
  cancelTimer(): void;
}
interface CoordinationEntry {
  fingerprint: string;
  active: symbol;
  queue: CoordinationWaiter[];
  dead: boolean;
}
interface CoordinationDomain {
  client: object;
  database: object;
  entries: Map<string, CoordinationEntry>;
  dead: boolean;
  unsubscribe: (() => void) | undefined;
}
/** Internal scheduling only. Entries contain digests and permits, never submission/results. */
export function createPracticeAttemptCoordination(
  source: CoordinationSource,
  schedule: (run: () => void, ms: number) => () => void = (run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  },
) {
  const clients = new WeakMap<object, WeakMap<object, CoordinationDomain>>();
  const activeKeys = new Set<CoordinationEntry>();
  const waitingBudget = (remaining: () => number) => {
    const ms = remaining();
    if (!Number.isFinite(ms) || ms <= 2000 || ms > 10_000) throw unavailable();
    return ms;
  };
  const forget = (domain: CoordinationDomain) => {
    if (domain.entries.size) return;
    const databases = clients.get(domain.client);
    if (databases?.get(domain.database) === domain)
      databases.delete(domain.database);
    const unsubscribe = domain.unsubscribe;
    domain.unsubscribe = undefined;
    unsubscribe?.();
  };
  const failWaiters = (entry: CoordinationEntry) => {
    for (const waiter of entry.queue.splice(0)) {
      waiter.cancelTimer();
      waiter.reject(unconfirmed());
    }
  };
  const invalidate = (domain: CoordinationDomain) => {
    domain.dead = true;
    for (const entry of domain.entries.values()) {
      entry.dead = true;
      failWaiters(entry);
    }
    // Active permits retain capacity until their original operation finishes.
    const databases = clients.get(domain.client);
    if (databases?.get(domain.database) === domain)
      databases.delete(domain.database);
    const unsubscribe = domain.unsubscribe;
    domain.unsubscribe = undefined;
    try {
      unsubscribe?.();
    } catch {
      // The domain is already terminal; its active permits cannot authorize a return.
    }
  };
  const current = (domain: CoordinationDomain) => {
    try {
      const generation = source.generation();
      if (
        !source.local() ||
        domain.dead ||
        !generation.live ||
        generation.client !== domain.client ||
        generation.database !== domain.database
      )
        throw unavailable();
    } catch {
      invalidate(domain);
      throw unavailable();
    }
  };
  const permit = (
    domain: CoordinationDomain,
    key: string,
    entry: CoordinationEntry,
    replayOnly: boolean,
  ): CoordinationPermit => {
    const ticket = Symbol();
    entry.active = ticket;
    let finished = false;
    return Object.freeze({
      replayOnly,
      assert() {
        current(domain);
        if (finished || entry.dead || entry.active !== ticket)
          throw unavailable();
      },
      finish(success: boolean) {
        if (finished) return;
        finished = true;
        try {
          current(domain);
        } catch {
          success = false;
        }
        if (!success || entry.dead) {
          entry.dead = true;
          failWaiters(entry);
        } else {
          while (entry.queue.length) {
            const waiter = entry.queue.shift()!;
            waiter.cancelTimer();
            try {
              waitingBudget(waiter.remaining);
              current(domain);
              waiter.resolve(permit(domain, key, entry, true));
              return;
            } catch {
              waiter.reject(unavailable());
            }
          }
        }
        if (domain.entries.get(key) === entry) domain.entries.delete(key);
        activeKeys.delete(entry);
        try {
          forget(domain);
        } catch {
          throw unconfirmed();
        }
      },
    });
  };
  return Object.freeze({
    async enter(
      owner: string,
      keyHash: string,
      fingerprint: string,
      remaining: () => number,
    ): Promise<CoordinationPermit | null> {
      let generation: ReturnType<CoordinationSource['generation']>;
      try {
        if (!source.local()) return null;
        generation = source.generation();
      } catch {
        throw unavailable();
      }
      if (
        !/^[a-f0-9]{24}(?![\s\S])/.test(owner) ||
        !/^[a-f0-9]{64}(?![\s\S])/.test(keyHash) ||
        !/^[a-f0-9]{64}(?![\s\S])/.test(fingerprint)
      )
        throw unavailable();
      waitingBudget(remaining);
      if (
        !generation.live ||
        !generation.client ||
        !generation.database ||
        typeof generation.client !== 'object' ||
        typeof generation.database !== 'object'
      )
        throw unavailable();
      let databases = clients.get(generation.client);
      if (!databases)
        clients.set(generation.client, (databases = new WeakMap()));
      let domain = databases.get(generation.database);
      if (!domain) {
        if (activeKeys.size >= 100) throw unavailable();
        domain = {
          client: generation.client,
          database: generation.database,
          entries: new Map(),
          dead: false,
          unsubscribe: undefined,
        };
        databases.set(generation.database, domain);
        try {
          const created = domain;
          const unsubscribe = source.onLoss(() => invalidate(created));
          domain.unsubscribe = unsubscribe;
          current(domain);
        } catch {
          invalidate(domain);
          throw unavailable();
        }
      }
      current(domain);
      const key = `${owner}:${keyHash}`;
      const existing = domain.entries.get(key);
      if (!existing) {
        if (activeKeys.size >= 100) throw unavailable();
        const entry: CoordinationEntry = {
          fingerprint,
          active: Symbol(),
          queue: [],
          dead: false,
        };
        domain.entries.set(key, entry);
        activeKeys.add(entry);
        return permit(domain, key, entry, false);
      }
      if (existing.fingerprint !== fingerprint) throw conflict();
      if (existing.dead || existing.queue.length >= 10) throw unavailable();
      return new Promise<CoordinationPermit>((resolve, reject) => {
        const waiter: CoordinationWaiter = {
          remaining,
          resolve,
          reject,
          cancelTimer() {},
        };
        existing.queue.push(waiter);
        try {
          waiter.cancelTimer = schedule(
            () => {
              const index = existing.queue.indexOf(waiter);
              if (index < 0) return;
              existing.queue.splice(index, 1);
              waiter.cancelTimer();
              reject(unavailable());
            },
            waitingBudget(remaining) - 2000,
          );
        } catch {
          existing.queue.splice(existing.queue.indexOf(waiter), 1);
          reject(unavailable());
        }
      });
    },
  });
}
export type PracticeAttemptCoordination = ReturnType<
  typeof createPracticeAttemptCoordination
>;
// Match the existing validated server APP_ENV default without parsing unrelated secrets here.
// This immutable server-side snapshot is never supplied by a request.
const localCoordination = (process.env.APP_ENV ?? 'LOCAL') === 'LOCAL';
export const practiceAttemptCoordination = createPracticeAttemptCoordination({
  local: () => localCoordination,
  generation: () => mongoQualification.generation(),
  onLoss: (invalidate) => mongoQualification.onLoss(invalidate),
});
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
  progressBefore(
    userId: Types.ObjectId,
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<ProgressBaseline>;
  progressAfter(
    baseline: ProgressBaseline,
    record: AttemptRecord,
    session: ClientSession,
  ): Promise<void>;
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
export const mongoAttemptStore: AttemptStore = {
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
    const progressTime = Math.floor(timeoutMS - (performance.now() - start));
    if (progressTime <= 0) throw unavailable();
    await progressRepository.ready(progressTime);
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
  progressBefore: (userId, conceptId, session) =>
    progressRepository.prepare(userId, conceptId, session),
  progressAfter: (baseline, record, session) =>
    progressRepository.record(baseline, record, session),
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
  store: AttemptStore = mongoAttemptStore,
  clock = () => performance.now(),
  qualification: CompletionGrading | null = store === mongoAttemptStore
    ? completionGrading
    : null,
  coordination: PracticeAttemptCoordination | null = store === mongoAttemptStore
    ? practiceAttemptCoordination
    : null,
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
      let assessment: Awaited<ReturnType<CompletionGrading['record']>>;
      let coordinated: CoordinationPermit | null | undefined;
      try {
        await store.ready(remaining());
        await qualification?.before(userId, input.questionId, remaining());
        coordinated = await coordination?.enter(
          userId,
          key,
          request,
          remaining,
        );
        coordinated?.assert();
        if (coordinated?.replayOnly) {
          await store.ready(remaining());
          await qualification?.before(userId, input.questionId, remaining());
          coordinated.assert();
        }
        session = await store.session();
        while (!committed && bodies < 3) {
          const available = remaining() - 2000;
          if (available <= 0) throw unavailable();
          let candidate: AttemptRecord | undefined;
          try {
            await session.withTransaction(
              async () => {
                if (++bodies > 3 || remaining() <= 2000) throw unavailable();
                coordinated?.assert();
                candidate = undefined;
                assessment = undefined;
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
                  assessment = await qualification?.record(row, true, {
                    session: session!,
                  });
                  candidate = row;
                  return;
                }
                if (coordinated?.replayOnly) throw unconfirmed();
                if (content.questionRevision !== input.questionRevision)
                  throw changed();
                const progress = await store.progressBefore(
                  owner,
                  concept,
                  session!,
                );
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
                assessment = await qualification?.record(row, false, {
                  session: session!,
                });
                await store.progressAfter(progress, row, session!);
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
            if (
              (knownDuplicate(error) ||
                error instanceof ProgressWriteConflict ||
                error instanceof GradingWriteConflict) &&
              bodies < 3
            )
              continue;
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
        remaining();
        await qualification?.proof(
          proof.data,
          {
            session,
            // Proof runs after withTransaction: each database operation needs
            // the caller's current deadline, not a reusable timeout snapshot.
            get timeoutMS() {
              return remaining();
            },
            majority: true,
          },
          assessment,
        );
        remaining();
        coordinated?.assert();
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
        // Cleanup also spends the original budget. Refuse before admitting a
        // queued follower as successful or allowing any disclosure response.
        if (outcome && !failure) {
          try {
            remaining();
          } catch {
            failure = unavailable();
            outcome = undefined;
          }
        }
        if (coordinated) {
          try {
            coordinated.assert();
          } catch {
            failure ??= unconfirmed();
            outcome = undefined;
          }
          try {
            coordinated.finish(!failure && outcome !== undefined);
          } catch {
            failure ??= unconfirmed();
            outcome = undefined;
          }
        }
      }
      if (failure) throw failure;
      if (!outcome) throw unconfirmed();
      remaining();
      return outcome;
    },
  };
}
export const practiceAttemptRepository = createPracticeAttemptRepository();
export type PracticeAttemptRepository = ReturnType<
  typeof createPracticeAttemptRepository
>;
