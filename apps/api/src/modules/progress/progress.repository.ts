import { performance } from 'node:perf_hooks';
import { Types, type ClientSession } from 'mongoose';
import { MongoServerError } from 'mongodb';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  Concept,
  completionRulesFromStorage,
} from '../concepts/concept.model.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import {
  attemptRecord,
  type AttemptRecord,
} from '../practice/practice-attempt.model.js';
import { completionAssessmentRecord } from '../practice/practice-assessment.model.js';
import {
  StudentProgress,
  progressIndex,
  progressRecord,
  emptyCompletionFields,
  type ProgressRecord,
} from './progress.model.js';
import {
  activityStats,
  progressDto,
  type ActivityStats,
} from './progress.dto.js';

const unavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Activity is temporarily unavailable',
  );
const hidden = () =>
  new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
const oid = z.instanceof(Types.ObjectId);
const hierarchySchema = z.strictObject({
  conceptId: oid,
  technologyId: oid,
  learningPathId: oid,
  moduleId: oid,
  topicId: oid,
});
export type ProgressHierarchy = z.output<typeof hierarchySchema>;
export type ProgressBaseline = {
  userId: Types.ObjectId;
  hierarchy: ProgressHierarchy;
  stats: ActivityStats;
  summary: ProgressRecord | null;
  session: ClientSession;
};
export function verifyProgressIndexes(indexes: Record<string, unknown>[]) {
  const matches = indexes.filter((row) => row.name === progressIndex.name);
  if (matches.length !== 1) throw unavailable();
  const row = matches[0]!;
  if (
    row.v !== 2 ||
    row.unique !== true ||
    JSON.stringify(row.key) !== JSON.stringify(progressIndex.key) ||
    Object.keys(row).some(
      (key) => !['v', 'name', 'key', 'unique'].includes(key),
    )
  )
    throw unavailable();
}
export class ProgressWriteConflict extends Error {
  constructor() {
    super('Progress conflict');
    this.name = 'ProgressWriteConflict';
  }
}
export interface ProgressStore {
  ready(timeoutMS: number): Promise<void>;
  session(): Promise<ClientSession>;
  hierarchy(
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<unknown | null>;
  stats(
    userId: Types.ObjectId,
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<ActivityStats>;
  summaries(
    userId: Types.ObjectId,
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<unknown[]>;
  insert(row: ProgressRecord, session: ClientSession): Promise<void>;
  qualifyingScores?(
    userId: Types.ObjectId,
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<{
    firstScore: 0 | 100;
    latestScore: 0 | 100;
    bestScore: 0 | 100;
    attemptIds: string[];
  } | null>;
  update(
    before: ProgressRecord,
    after: ProgressRecord,
    session: ClientSession,
  ): Promise<boolean>;
}
const db = () => {
  if (!mongoose.connection.db) throw unavailable();
  return mongoose.connection.db;
};
const summaries = () => db().collection<ProgressRecord>('studentProgress');
export function attemptStatsStages(
  userId: Types.ObjectId,
  conceptId: Types.ObjectId,
) {
  return [
    { $match: { userId, conceptId } },
    {
      $group: {
        _id: null,
        attemptCount: { $sum: 1 },
        startedAt: { $min: '$submittedAt' },
        lastActivityAt: { $max: '$submittedAt' },
        invalid: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $type: '$_id' }, 'objectId'] },
                  { $eq: [{ $type: '$questionId' }, 'objectId'] },
                  { $eq: ['$schemaVersion', 1] },
                  { $eq: ['$result', 'SUBMITTED'] },
                  { $eq: [{ $type: '$score' }, 'null'] },
                  { $eq: [{ $type: '$submittedAt' }, 'date'] },
                  {
                    $in: [
                      '$type',
                      ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'],
                    ],
                  },
                  { $isNumber: '$attemptNumber' },
                  { $gte: ['$attemptNumber', 1] },
                  { $lte: ['$attemptNumber', Number.MAX_SAFE_INTEGER] },
                  { $eq: ['$attemptNumber', { $trunc: '$attemptNumber' }] },
                ],
              },
              0,
              1,
            ],
          },
        },
      },
    },
  ];
}
const nativeStore: ProgressStore = {
  async ready(timeoutMS) {
    if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) throw unavailable();
    const started = performance.now(),
      hello = await db().admin().command({ hello: 1 }, { timeoutMS });
    if (
      !hello.isWritablePrimary ||
      (!hello.setName && hello.msg !== 'isdbgrid') ||
      hello.logicalSessionTimeoutMinutes == null
    )
      throw unavailable();
    const remaining = Math.floor(timeoutMS - (performance.now() - started));
    if (remaining <= 0) throw unavailable();
    verifyProgressIndexes(await summaries().indexes({ timeoutMS: remaining }));
  },
  session: () => mongoose.connection.startSession({ causalConsistency: true }),
  async hierarchy(conceptId, session) {
    const [row] = await Concept.aggregate([
      ...publishedConceptStages(conceptId.toHexString()),
      {
        $project: {
          _id: 0,
          conceptId: '$_id',
          technologyId: 1,
          learningPathId: 1,
          moduleId: 1,
          topicId: 1,
        },
      },
    ])
      .option({ session, readPreference: 'primary' })
      .exec();
    return row ?? null;
  },
  async stats(userId, conceptId, session) {
    const [row] = await db()
      .collection('practiceAttempts')
      .aggregate(attemptStatsStages(userId, conceptId), {
        session,
        readPreference: 'primary',
      })
      .toArray();
    if (!row) return { attemptCount: 0, startedAt: null, lastActivityAt: null };
    if (row.invalid !== 0) throw unavailable();
    return activityStats.parse({
      attemptCount: row.attemptCount,
      startedAt: row.startedAt,
      lastActivityAt: row.lastActivityAt,
    });
  },
  summaries: (userId, conceptId, session) =>
    summaries().find({ userId, conceptId }, { session }).limit(2).toArray(),
  async insert(row, session) {
    try {
      await new StudentProgress(row).save({ session });
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000 &&
        JSON.stringify(error.keyPattern) ===
          JSON.stringify(progressIndex.key) &&
        error.message.includes(
          'collection: ' +
            db().databaseName +
            '.studentProgress index: ' +
            progressIndex.name +
            ' dup key:',
        )
      )
        throw new ProgressWriteConflict();
      throw error;
    }
  },
  async update(before, after, session) {
    const result = await summaries().updateOne(
      { _id: before._id, userId: before.userId, conceptId: before.conceptId },
      {
        $set: {
          attemptCount: after.attemptCount,
          status: after.status,
          startedAt: after.startedAt,
          lastActivityAt: after.lastActivityAt,
          updatedAt: after.updatedAt,
          ...(after.schemaVersion === 2
            ? {
                schemaVersion: 2,
                sections: after.sections,
                firstScore: after.firstScore,
                latestScore: after.latestScore,
                bestScore: after.bestScore,
                completedAt: after.completedAt,
                completion: after.completion,
              }
            : {}),
        },
      },
      { session },
    );
    return result.matchedCount === 1 && result.modifiedCount === 1;
  },
  async qualifyingScores(userId, conceptId, session) {
    const values = await db()
      .collection('practiceAssessments')
      .find(
        { userId, conceptId, purpose: 'COMPLETION_INPUT', schemaVersion: 2 },
        { session },
      )
      .sort({ evaluatedAt: 1, _id: 1 })
      .limit(11)
      .toArray();
    if (!values.length) return null;
    if (values.length > 10) throw unavailable();
    const parent = await db()
      .collection('concepts')
      .findOne(
        { _id: conceptId },
        { session, projection: { completionRules: 1 } },
      );
    if (!parent?.completionRules) throw unavailable();
    const rules = completionRulesFromStorage(parent.completionRules);
    const rows = values.map((v) => completionAssessmentRecord.parse(v));
    if (
      new Set(rows.map((r) => r.attemptId.toHexString())).size !== rows.length
    )
      throw unavailable();
    for (const r of rows) {
      const policy = rules.versions.find(
        (p) =>
          p.policyId === r.policyId.toHexString() &&
          p.version === r.policyVersion,
      );
      const a = attemptRecord.parse(
        await db()
          .collection('practiceAttempts')
          .findOne({ _id: r.attemptId, userId, conceptId }, { session }),
      );
      if (
        !policy ||
        policy.approvedAt === null ||
        policy.approvedAt > r.evaluatedAt ||
        policy.fingerprint !== r.policyFingerprint ||
        policy.sourceEpoch !== r.sourceEpoch ||
        policy.questionId !== r.questionId.toHexString() ||
        policy.rubricId !== r.rubricId.toHexString() ||
        policy.rubricVersion !== r.rubricVersion ||
        policy.rubricDefinitionFingerprint !== r.rubricDefinitionFingerprint ||
        policy.questionRevision !== r.questionRevision ||
        policy.contentFingerprint !== r.contentFingerprint ||
        !r.userId.equals(userId) ||
        !r.conceptId.equals(conceptId) ||
        a.attemptNumber !== 1 ||
        !a.questionId.equals(r.questionId) ||
        a.requestFingerprint !== r.attemptRequestFingerprint ||
        a.questionRevision !== r.questionRevision ||
        a.contentFingerprint !== r.contentFingerprint
      )
        throw unavailable();
    }
    return {
      firstScore: rows[0]!.score,
      latestScore: rows.at(-1)!.score,
      bestScore: rows.some((r) => r.score === 100) ? 100 : 0,
      attemptIds: rows.map((r) => r.attemptId.toHexString()),
    };
  },
};
export function createProgressRepository(
  store: ProgressStore = nativeStore,
  clock = () => performance.now(),
) {
  async function prepare(
    userId: Types.ObjectId,
    conceptId: Types.ObjectId,
    session: ClientSession,
  ): Promise<ProgressBaseline> {
    const raw = await store.hierarchy(conceptId, session);
    if (!raw) throw hidden();
    const hierarchy = hierarchySchema.parse(raw);
    if (!hierarchy.conceptId.equals(conceptId)) throw unavailable();
    const stats = activityStats.parse(
      await store.stats(userId, conceptId, session),
    );
    const rows = await store.summaries(userId, conceptId, session);
    if (rows.length > 1) throw unavailable();
    const summary = rows.length ? progressRecord.parse(rows[0]) : null;
    if (
      summary &&
      (!summary.userId.equals(userId) ||
        Object.entries(hierarchy).some(
          ([key, value]) =>
            !value.equals(summary[key as keyof ProgressHierarchy]),
        ) ||
        summary.attemptCount !== stats.attemptCount ||
        summary.startedAt.getTime() !== stats.startedAt?.getTime() ||
        summary.lastActivityAt.getTime() !== stats.lastActivityAt?.getTime())
    )
      throw unavailable();
    return { userId, hierarchy, stats, summary, session };
  }
  return {
    ready: (ms: number) => store.ready(ms),
    prepare,
    async record(
      baseline: ProgressBaseline,
      attempt: AttemptRecord,
      session: ClientSession,
    ) {
      if (
        session !== baseline.session ||
        !attempt.userId.equals(baseline.userId) ||
        !attempt.conceptId.equals(baseline.hierarchy.conceptId)
      )
        throw unavailable();
      const stats = activityStats.parse(
        await store.stats(baseline.userId, attempt.conceptId, session),
      );
      const start = Math.min(
        baseline.stats.startedAt?.getTime() ?? Infinity,
        attempt.submittedAt.getTime(),
      );
      const last = Math.max(
        baseline.stats.lastActivityAt?.getTime() ?? -Infinity,
        attempt.submittedAt.getTime(),
      );
      if (
        stats.attemptCount !== baseline.stats.attemptCount + 1 ||
        stats.startedAt?.getTime() !== start ||
        stats.lastActivityAt?.getTime() !== last
      )
        throw unavailable();
      const now = new Date(
        Math.max(Date.now(), baseline.summary?.updatedAt.getTime() ?? 0),
      );
      const grades = await store.qualifyingScores?.(
        baseline.userId,
        attempt.conceptId,
        session,
      );
      const prior = baseline.summary;
      if (
        prior?.schemaVersion === 2 &&
        prior.firstScore !== null &&
        store.qualifyingScores
      ) {
        if (
          !grades ||
          grades.firstScore !== prior.firstScore ||
          (!grades.attemptIds.includes(attempt._id.toHexString()) &&
            (grades.latestScore !== prior.latestScore ||
              grades.bestScore !== prior.bestScore))
        )
          throw unavailable();
      }
      const v2 =
        prior?.schemaVersion === 2 ||
        grades?.attemptIds.includes(attempt._id.toHexString());
      const row = progressRecord.parse({
        ...baseline.hierarchy,
        _id: baseline.summary?._id ?? new Types.ObjectId(),
        userId: baseline.userId,
        ...stats,
        status: prior?.schemaVersion === 2 ? prior.status : 'IN_PROGRESS',
        schemaVersion: v2 ? 2 : 1,
        ...(v2
          ? {
              ...emptyCompletionFields(),
              ...(prior?.schemaVersion === 2
                ? {
                    sections: prior.sections,
                    completion: prior.completion,
                    completedAt: prior.completedAt,
                    firstScore: prior.firstScore,
                    latestScore: prior.latestScore,
                    bestScore: prior.bestScore,
                  }
                : {}),
              ...(grades
                ? {
                    firstScore: grades.firstScore,
                    latestScore: grades.latestScore,
                    bestScore: grades.bestScore,
                  }
                : {}),
            }
          : {}),
        createdAt: baseline.summary?.createdAt ?? now,
        updatedAt: now,
      });
      if (baseline.summary) {
        if (!(await store.update(baseline.summary, row, session)))
          throw unavailable();
      } else await store.insert(row, session);
    },
    async read(userId: string, conceptId: string) {
      if (!/^[a-f0-9]{24}$/.test(userId) || !/^[a-f0-9]{24}$/.test(conceptId))
        throw unavailable();
      const started = clock(),
        remaining = () => {
          const ms = Math.floor(5000 - (clock() - started));
          if (ms <= 0) throw unavailable();
          return ms;
        };
      let session: ClientSession | undefined,
        result: ReturnType<typeof progressDto> | undefined,
        failure: unknown;
      try {
        await store.ready(remaining());
        session = await store.session();
        let bodies = 0;
        await session.withTransaction(
          async () => {
            if (++bodies > 3) throw unavailable();
            const snapshot = await prepare(
              new Types.ObjectId(userId),
              new Types.ObjectId(conceptId),
              session!,
            );
            result = progressDto(conceptId, snapshot.stats);
          },
          {
            timeoutMS: remaining(),
            maxCommitTimeMS: 1000,
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', j: true },
            readPreference: 'primary',
          },
        );
      } catch (error) {
        failure = error;
      } finally {
        if (session)
          try {
            await session.endSession();
          } catch {
            failure = unavailable();
            result = undefined;
          }
      }
      if (failure) {
        if (failure instanceof AppError && failure.code === 'CONCEPT_NOT_FOUND')
          throw failure;
        throw unavailable();
      }
      if (!result) throw unavailable();
      return result;
    },
  };
}
export const progressRepository = createProgressRepository();
export type ProgressRepository = ReturnType<typeof createProgressRepository>;
