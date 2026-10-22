import { Types, type ClientSession } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import { conceptCompletionRules } from '../concepts/concept.model.js';
import {
  assessmentIndex,
  assessmentRecord,
} from '../practice/practice-assessment.model.js';
import { attemptIndexes } from '../practice/practice-attempt.model.js';
import {
  mongoRubrics,
  gradingOptions,
  type GradingRead,
} from '../practice/practice-rubric.repository.js';
import { verifyCompletionIndex } from './completion.repository.js';
import {
  qualificationAuthority,
  type QualificationAuthority,
} from './completion-evidence.service.js';
import { mongoQualification } from './section-evidence.repository.js';
import {
  progressRepository,
  type ProgressBaseline,
} from './progress.repository.js';
import {
  progressRecord,
  progressIndex,
  type ProgressRecord,
} from './progress.model.js';
import { progressDto, type ProgressDto } from './progress.dto.js';
import { dashboardConcept, type DashboardConcept } from './dashboard.dto.js';
import type { DashboardQuery } from './dashboard.schema.js';

export const dashboardUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Dashboard is temporarily unavailable',
  );
export type Remaining = () => number;
export type DashboardContext = {
  identity: string;
  origin: QualificationAuthority | null;
};
export type DashboardRow = {
  concept: DashboardConcept;
  activity: ProgressDto;
  context: DashboardContext;
};
export interface DashboardStore {
  ready(ms: number): Promise<void>;
  actor(owner: string, read: GradingRead): Promise<void>;
  candidates(
    owner: string,
    cursor: string | undefined,
    read: GradingRead,
  ): Promise<unknown[]>;
  published(concept: string, read: GradingRead): Promise<unknown | null>;
  session(ms: number): Promise<ClientSession>;
  prepare(
    owner: Types.ObjectId,
    concept: Types.ObjectId,
    session: ClientSession,
  ): Promise<ProgressBaseline>;
  summary(
    owner: string,
    concept: string,
    read: GradingRead,
  ): Promise<unknown[]>;
  policy(concept: string, read: GradingRead): Promise<unknown | null>;
  assessments(
    owner: string,
    concept: string,
    read: GradingRead,
  ): Promise<unknown[]>;
  authority(owner: string, question: string): QualificationAuthority | null;
}
const candidateSchema = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  userId: z.instanceof(Types.ObjectId),
  conceptId: z.instanceof(Types.ObjectId),
});
const database = () => {
  if (!mongoose.connection.db) throw dashboardUnavailable();
  return mongoose.connection.db;
};
const nativeStore: DashboardStore = {
  async ready(ms) {
    const started = performance.now();
    const remaining = () => {
      const n = Math.floor(ms - (performance.now() - started));
      if (n <= 0) throw dashboardUnavailable();
      return n;
    };
    await progressRepository.ready(remaining());
    for (const collection of [
      'studentProgress',
      'practiceAttempts',
      'practiceAssessments',
    ]) {
      const info = await database()
        .listCollections(
          { name: collection },
          {
            nameOnly: false,
            timeoutMS: remaining(),
          },
        )
        .toArray();
      if (
        info.length !== 1 ||
        info[0]!.type !== 'collection' ||
        info[0]!.options?.collation
      )
        throw dashboardUnavailable();
    }
    verifyCompletionIndex(
      await database()
        .collection('practiceAttempts')
        .indexes({ timeoutMS: remaining() }),
      {
        ...attemptIndexes[2]!,
        collection: 'practiceAttempts',
      },
    );
    verifyCompletionIndex(
      await database()
        .collection('practiceAssessments')
        .indexes({ timeoutMS: remaining() }),
      assessmentIndex,
    );
  },
  actor: (owner, read) => mongoRubrics.actor(owner, 'STUDENT', read),
  candidates: (owner, cursor, read) =>
    database()
      .collection('studentProgress')
      .find(
        {
          userId: new Types.ObjectId(owner),
          ...(cursor ? { conceptId: { $gt: new Types.ObjectId(cursor) } } : {}),
        },
        {
          ...gradingOptions(read),
          projection: { _id: 1, userId: 1, conceptId: 1 },
          hint: progressIndex.name,
        },
      )
      .sort({ conceptId: 1 })
      .limit(101)
      .toArray(),
  async published(id, read) {
    const rows = await database()
      .collection('concepts')
      .aggregate(
        [
          ...publishedConceptStages(id),
          {
            $project: {
              _id: 0,
              id: { $toString: '$_id' },
              title: 1,
              slug: 1,
              difficulty: 1,
            },
          },
          { $limit: 2 },
        ],
        gradingOptions(read),
      )
      .toArray();
    if (rows.length > 1) throw dashboardUnavailable();
    return rows[0] ?? null;
  },
  async session(ms) {
    // Avoid Mongoose's optional connection-buffer wait before the CSOT begins.
    const connection = mongoose.connection;
    if (connection.readyState !== 1 || !connection.db)
      throw dashboardUnavailable();
    return connection.getClient().startSession({
      causalConsistency: true,
      defaultTimeoutMS: ms,
    });
  },
  prepare: (owner, concept, session) =>
    progressRepository.prepare(owner, concept, session),
  summary: (owner, concept, read) =>
    database()
      .collection('studentProgress')
      .find(
        {
          userId: new Types.ObjectId(owner),
          conceptId: new Types.ObjectId(concept),
        },
        gradingOptions(read),
      )
      .limit(2)
      .toArray(),
  policy: (concept, read) => mongoQualification.policy(concept, read),
  assessments: (owner, concept, read) =>
    database()
      .collection('practiceAssessments')
      .find(
        {
          userId: new Types.ObjectId(owner),
          conceptId: new Types.ObjectId(concept),
        },
        gradingOptions(read),
      )
      .limit(33)
      .toArray(),
  authority: qualificationAuthority,
};

/** Dependencies are trusted internal adapters, never caller-supplied authority. */
export function createDashboardRepository(
  store: DashboardStore = nativeStore,
  clock = () => performance.now(),
) {
  function phase(remaining: Remaining) {
    const started = clock();
    return () => {
      const n = Math.floor(Math.min(5000 - (clock() - started), remaining()));
      if (!Number.isFinite(n) || n <= 0) throw dashboardUnavailable();
      return n;
    };
  }
  const majority = (remaining: Remaining): GradingRead => ({
    majority: true,
    get timeoutMS() {
      return remaining();
    },
  });
  function owned(raw: unknown, owner: string, concept: string) {
    const row = progressRecord.parse(raw);
    if (
      row.userId.toHexString() !== owner ||
      row.conceptId.toHexString() !== concept
    )
      throw dashboardUnavailable();
    return row;
  }
  async function context(
    owner: string,
    summary: ProgressRecord,
    read: GradingRead,
    remaining: Remaining,
  ): Promise<DashboardContext> {
    const id = summary.conceptId.toHexString();
    remaining();
    const raw = await store.policy(id, read);
    remaining();
    if (raw !== null) {
      const rules = conceptCompletionRules.parse(raw);
      const policy =
        rules.versions.find((p) => p.version === rules.activeVersion) ??
        rules.versions.at(-1);
      if (!policy || policy.conceptId !== id) throw dashboardUnavailable();
      const origin = store.authority(owner, policy.questionId);
      if (!origin) throw dashboardUnavailable();
      origin.assert();
      return { identity: JSON.stringify([summary, rules]), origin };
    }
    // Absence is established, not inferred from a classifier error or approval flag.
    if (summary.schemaVersion !== 1) throw dashboardUnavailable();
    const records = await store.assessments(owner, id, read);
    remaining();
    if (records.length > 32) throw dashboardUnavailable();
    const diagnostics = records.map((value) => {
      const a = assessmentRecord.parse(value);
      if (a.userId.toHexString() !== owner || a.conceptId.toHexString() !== id)
        throw dashboardUnavailable();
      return a;
    });
    return { identity: JSON.stringify([summary, diagnostics]), origin: null };
  }
  return {
    async discover(owner: string, query: DashboardQuery, budget: Remaining) {
      const remaining = phase(budget),
        read = majority(remaining);
      await store.ready(remaining());
      await store.actor(owner, read);
      remaining();
      const candidates = await store.candidates(owner, query.cursor, read);
      remaining();
      if (candidates.length > 101) throw dashboardUnavailable();
      const found: DashboardConcept[] = [];
      let previous = query.cursor ?? '';
      for (const value of candidates.slice(0, 100)) {
        remaining();
        const row = candidateSchema.parse(value),
          id = row.conceptId.toHexString();
        if (row.userId.toHexString() !== owner || id <= previous)
          throw dashboardUnavailable();
        previous = id;
        const raw = await store.published(id, read);
        remaining();
        if (raw === null) continue;
        const concept = dashboardConcept.parse(raw);
        if (concept.id !== id) throw dashboardUnavailable();
        found.push(concept);
        if (found.length > query.limit)
          return {
            concepts: found.slice(0, query.limit),
            pagination: {
              limit: query.limit,
              nextCursor: found[query.limit - 1]!.id,
            },
          };
      }
      if (candidates.length > 100) throw dashboardUnavailable();
      remaining();
      return {
        concepts: found,
        pagination: { limit: query.limit, nextCursor: null },
      };
    },
    async activity(
      owner: string,
      concepts: DashboardConcept[],
      budget: Remaining,
    ): Promise<DashboardRow[]> {
      const remaining = phase(budget);
      if (concepts.length > 5) throw dashboardUnavailable();
      if (!concepts.length) return [];
      let session: ClientSession | undefined;
      let rows: DashboardRow[] | undefined;
      let failure: unknown;
      try {
        session = await store.session(remaining());
        const available = remaining() - 1000;
        if (available <= 0) throw dashboardUnavailable();
        let bodies = 0;
        await session.withTransaction(
          async () => {
            // Do not automatically retry a dashboard phase on transient contention.
            if (++bodies > 1) throw dashboardUnavailable();
            rows = undefined;
            await store.actor(owner, { session: session! });
            const prepared: DashboardRow[] = [];
            for (const concept of concepts) {
              remaining();
              const baseline = await store.prepare(
                new Types.ObjectId(owner),
                new Types.ObjectId(concept.id),
                session!,
              );
              remaining();
              if (
                baseline.session !== session ||
                baseline.userId.toHexString() !== owner ||
                baseline.hierarchy.conceptId.toHexString() !== concept.id ||
                !baseline.summary
              )
                throw dashboardUnavailable();
              const summary = owned(baseline.summary, owner, concept.id);
              const activity = progressDto(concept.id, baseline.stats);
              if (!activity.attemptCount) throw dashboardUnavailable();
              prepared.push({
                concept,
                activity,
                context: await context(
                  owner,
                  summary,
                  { session: session! },
                  remaining,
                ),
              });
            }
            remaining();
            rows = prepared;
          },
          {
            timeoutMS: available,
            maxCommitTimeMS: Math.min(1000, available),
            readPreference: 'primary',
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority', j: true },
          },
        );
        remaining();
      } catch (error) {
        failure = error;
      } finally {
        if (session)
          try {
            await session.endSession({ timeoutMS: 1000 });
          } catch {
            failure = dashboardUnavailable();
          }
      }
      if (failure) throw failure;
      remaining();
      if (!rows) throw dashboardUnavailable();
      return rows;
    },
    async finish(owner: string, rows: DashboardRow[], budget: Remaining) {
      const remaining = phase(budget),
        read = majority(remaining);
      await store.actor(owner, read);
      for (const row of rows) {
        remaining();
        row.context.origin?.assert();
        const concept = dashboardConcept.parse(
          await store.published(row.concept.id, read),
        );
        if (JSON.stringify(concept) !== JSON.stringify(row.concept))
          throw dashboardUnavailable();
        const summaries = await store.summary(owner, concept.id, read);
        remaining();
        if (summaries.length !== 1) throw dashboardUnavailable();
        const fresh = await context(
          owner,
          owned(summaries[0], owner, concept.id),
          read,
          remaining,
        );
        if (
          fresh.origin !== row.context.origin ||
          fresh.identity !== row.context.identity
        )
          throw dashboardUnavailable();
        fresh.origin?.assert();
      }
      await store.actor(owner, read);
      remaining();
    },
  };
}
export type DashboardRepository = ReturnType<typeof createDashboardRepository>;
