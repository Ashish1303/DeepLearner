import { Types, type ClientSession } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { publishedConceptStages } from '../concepts/concept.repository.js';
import {
  conceptDetailDto,
  type ProjectedConceptDetail,
} from '../concepts/concept.dto.js';
import {
  SectionEvidenceChallenge,
  acknowledgementChallengeRecord,
  challengeRecord,
  challengeIndex,
  type EvidenceChallenge,
} from './section-evidence-challenge.model.js';
import {
  SectionActivityReceipt,
  acknowledgementReceiptRecord,
  receiptRecord,
  receiptIndexes,
  type EvidenceReceipt,
} from './section-evidence-receipt.model.js';
import {
  sectionEvidenceRevision,
  additionalSectionRevision,
} from './section-evidence-revision.js';
import {
  Concept,
  conceptCompletionRules,
  completionRulesToStorage,
  completionRulesFromStorage,
  type ConceptCompletionRules,
} from '../concepts/concept.model.js';
import { User } from '../users/user.model.js';
import { PracticeQuestion } from '../practice/practice-question.model.js';
import {
  mongoGrading,
  type GradingStore,
} from '../practice/practice-assessment.repository.js';
import { GradingWriteConflict } from '../practice/practice-rubric.repository.js';
import { checkpointDefinitionIndex } from '../visualizations/visualization-checkpoint-definition.model.js';

export const evidenceUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Section activity is unavailable',
  );
export const evidenceUnconfirmed = () =>
  new AppError(
    503,
    'SECTION_EVIDENCE_UNCONFIRMED',
    'Section activity could not be confirmed',
  );
export const evidenceConflict = () =>
  new AppError(
    409,
    'SECTION_EVIDENCE_CONFLICT',
    'Request conflicts with saved identity',
  );
export const challengeUnavailable = () =>
  new AppError(
    409,
    'SECTION_CHALLENGE_UNAVAILABLE',
    'Challenge is unavailable',
  );
export const challengeHidden = () =>
  new AppError(404, 'SECTION_CHALLENGE_NOT_FOUND', 'Challenge not found');
export class EvidenceWriteConflict extends Error {}
export type SyntheticIdentity = {
  userId: string;
  conceptId: string;
  questionId: string;
  sourceEpoch: string;
};
export type SyntheticCreation = SyntheticIdentity & {
  topicId: string;
  authorId: string;
  passwordHash: string;
  summary: string;
  bodyMarkdown: string;
  example: string;
  prompt: string;
  answer: string;
  revise?: { summary: string; keyPoints: string[] } | undefined;
};
export interface QualificationStore extends GradingStore {
  generation(): { client: object; database: object; live: boolean };
  onLoss(invalidate: () => void): () => void;
  target(read: EvidenceRead): Promise<void>;
  createSynthetic(value: SyntheticCreation, read: EvidenceRead): Promise<void>;
  syntheticProof(value: SyntheticCreation, read: EvidenceRead): Promise<void>;
  conceptRevision(conceptId: string, read: EvidenceRead): Promise<string>;
  sectionRevision(
    conceptId: string,
    section: 'READ' | 'EXAMPLE' | 'REVISE',
    read: EvidenceRead,
  ): Promise<string>;
  policy(
    conceptId: string,
    read: EvidenceRead,
  ): Promise<ConceptCompletionRules | null>;
  policyWrite(
    conceptId: string,
    before: ConceptCompletionRules | null,
    after: ConceptCompletionRules,
    read: EvidenceRead,
  ): Promise<void>;
  actions(
    owner: string,
    concept: string,
    section: 'READ' | 'EXAMPLE' | 'REVISE' | 'VISUALIZE',
    read: EvidenceRead,
  ): Promise<{ challenge: unknown; receipt: unknown }[]>;
}
export type EvidenceRead = {
  session?: ClientSession;
  timeoutMS?: number;
  majority?: boolean;
};
export const evidenceIndexes = [challengeIndex, ...receiptIndexes];
export function verifyEvidenceIndex(
  rows: Record<string, unknown>[],
  expected: { name: string; key: Readonly<Record<string, number>> },
) {
  const r = rows.find((i) => i.name === expected.name);
  if (
    !r ||
    JSON.stringify(r.key) !== JSON.stringify(expected.key) ||
    r.v !== 2 ||
    r.unique !== true ||
    Object.keys(r).some((k) => !['name', 'key', 'v', 'unique'].includes(k))
  )
    throw evidenceUnavailable();
}
const database = () => {
  if (!mongoose.connection.db) throw evidenceUnavailable();
  return mongoose.connection.db;
};
function options(r: EvidenceRead) {
  return {
    ...(r.session ? { session: r.session } : {}),
    ...(r.timeoutMS === undefined ? {} : { timeoutMS: r.timeoutMS }),
    ...(r.majority
      ? {
          readConcern: { level: 'majority' as const },
          readPreference: 'primary' as const,
        }
      : {}),
  };
}
function write(r: EvidenceRead) {
  if (!r.session?.inTransaction()) throw evidenceUnavailable();
  return r.session;
}
export interface EvidenceStore {
  ready(timeoutMS: number): Promise<void>;
  session(): Promise<ClientSession>;
  actor(owner: Types.ObjectId, read: EvidenceRead): Promise<void>;
  revision(
    concept: Types.ObjectId,
    read: EvidenceRead,
  ): Promise<ReturnType<typeof sectionEvidenceRevision>>;
  challenge(
    owner: Types.ObjectId,
    identity: { _id: Types.ObjectId } | { issueKeyHash: string },
    read: EvidenceRead,
  ): Promise<EvidenceChallenge | null>;
  receipt(
    owner: Types.ObjectId,
    identity: { _id: Types.ObjectId } | { ackKeyHash: string },
    read: EvidenceRead,
  ): Promise<EvidenceReceipt | null>;
  insertChallenge(row: EvidenceChallenge, read: EvidenceRead): Promise<void>;
  insertReceipt(row: EvidenceReceipt, read: EvidenceRead): Promise<void>;
  fence(
    before: EvidenceChallenge,
    after: EvidenceChallenge,
    read: EvidenceRead,
  ): Promise<void>;
}
const challenges = () =>
  database().collection<EvidenceChallenge>(challengeIndex.collection);
const receipts = () =>
  database().collection<EvidenceReceipt>('sectionActivityReceipts');
const challengeProjection = Object.fromEntries(
  Object.keys(SectionEvidenceChallenge.schema.paths).map((k) => [k, 1]),
);
const receiptProjection = Object.fromEntries(
  Object.keys(SectionActivityReceipt.schema.paths).map((k) => [k, 1]),
);
const conceptProjection = {
  _id: 1,
  technologyId: 1,
  learningPathId: 1,
  moduleId: 1,
  topicId: 1,
  title: 1,
  slug: 1,
  difficulty: 1,
  order: 1,
  contentFormat: 1,
  schemaVersion: 1,
  'read.summary': 1,
  'read.bodyMarkdown': 1,
  'source.label': 1,
  'source.url': 1,
  'source.sourceType': 1,
  'source.isOfficial': 1,
  'examples.title': 1,
  'examples.bodyMarkdown': 1,
  'revise.summary': 1,
  'revise.keyPoints': 1,
  'revise.memoryTrick': 1,
  'revise.importantCodeMarkdown': 1,
};
// Reject malformed stored optional fields before DTO absence normalization.
const storedConcept = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  technologyId: z.instanceof(Types.ObjectId),
  learningPathId: z.instanceof(Types.ObjectId),
  moduleId: z.instanceof(Types.ObjectId),
  topicId: z.instanceof(Types.ObjectId),
  title: z.string(),
  slug: z.string(),
  difficulty: z.string(),
  order: z.number(),
  contentFormat: z.string(),
  schemaVersion: z.number(),
  read: z.strictObject({ summary: z.string(), bodyMarkdown: z.string() }),
  source: z.strictObject({
    label: z.string(),
    url: z.string(),
    sourceType: z.string(),
    isOfficial: z.boolean(),
  }),
  examples: z
    .array(z.strictObject({ title: z.string(), bodyMarkdown: z.string() }))
    .optional(),
  revise: z
    .strictObject({
      summary: z.string(),
      keyPoints: z.array(z.string()).optional(),
      memoryTrick: z.string().optional(),
      importantCodeMarkdown: z.string().optional(),
    })
    .optional(),
});
export const mongoEvidence: EvidenceStore = {
  async ready(timeoutMS) {
    const start = performance.now();
    const remaining = () => {
      const n = Math.floor(timeoutMS - (performance.now() - start));
      if (n <= 0) throw evidenceUnavailable();
      return n;
    };
    const hello = await database()
      .admin()
      .command({ hello: 1 }, { timeoutMS: remaining() });
    if (
      !hello.isWritablePrimary ||
      (!hello.setName && hello.msg !== 'isdbgrid') ||
      hello.logicalSessionTimeoutMinutes == null
    )
      throw evidenceUnavailable();
    for (const collection of new Set(
      evidenceIndexes.map((i) => i.collection),
    )) {
      const info = await database()
        .listCollections(
          { name: collection },
          { nameOnly: false, timeoutMS: remaining() },
        )
        .toArray();
      // An absent collation means simple binary; alternate collection defaults refuse.
      if (
        info.length !== 1 ||
        info[0]!.type !== 'collection' ||
        info[0]!.options?.collation
      )
        throw evidenceUnavailable();
      const rows = await database()
        .collection(collection)
        .indexes({ timeoutMS: remaining() });
      for (const i of evidenceIndexes.filter(
        (i) => i.collection === collection,
      ))
        verifyEvidenceIndex(rows, i);
      if (
        !rows.some(
          (i) =>
            i.name === '_id_' &&
            JSON.stringify(i.key) === JSON.stringify({ _id: 1 }),
        )
      )
        throw evidenceUnavailable();
    }
  },
  session: () => mongoose.connection.startSession({ causalConsistency: true }),
  async actor(owner, read) {
    const row = await database()
      .collection('users')
      .findOne(
        { _id: owner },
        {
          ...options(read),
          projection: { _id: 1, role: 1, status: 1, emailVerifiedAt: 1 },
        },
      );
    if (
      !row ||
      !row._id.equals(owner) ||
      row.role !== 'STUDENT' ||
      row.status !== 'ACTIVE' ||
      !(row.emailVerifiedAt instanceof Date) ||
      !Number.isFinite(row.emailVerifiedAt.getTime())
    )
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        'Current eligible Student required',
      );
  },
  async revision(concept, read) {
    const rows = await database()
      .collection('concepts')
      .aggregate<ProjectedConceptDetail>(
        [
          ...publishedConceptStages(concept.toHexString()),
          { $project: conceptProjection },
        ],
        options(read),
      )
      .toArray();
    if (rows.length !== 1)
      throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
    storedConcept.parse(rows[0]);
    if (!rows[0]!._id.equals(concept)) throw evidenceUnavailable();
    return sectionEvidenceRevision(conceptDetailDto(rows[0]!));
  },
  async challenge(owner, identity, read) {
    const row = await challenges().findOne(
      { userId: owner, ...identity, section: 'READ', schemaVersion: 1 },
      { ...options(read), projection: challengeProjection },
    );
    return row ? acknowledgementChallengeRecord.parse(row) : null;
  },
  async receipt(owner, identity, read) {
    const row = await receipts().findOne(
      { userId: owner, ...identity, section: 'READ', schemaVersion: 1 },
      { ...options(read), projection: receiptProjection },
    );
    return row ? acknowledgementReceiptRecord.parse(row) : null;
  },
  async insertChallenge(row, read) {
    await new SectionEvidenceChallenge(challengeRecord.parse(row)).save({
      session: write(read),
    });
  },
  async insertReceipt(row, read) {
    await new SectionActivityReceipt(receiptRecord.parse(row)).save({
      session: write(read),
    });
  },
  async fence(before, after, read) {
    write(read);
    acknowledgementChallengeRecord.parse(before);
    acknowledgementChallengeRecord.parse(after);
    if (
      before.decisionFence >= Number.MAX_SAFE_INTEGER ||
      after.decisionFence !== before.decisionFence + 1 ||
      before.state === 'REVOKED'
    )
      throw evidenceUnavailable();
    const mutable = [
      'state',
      'decisionFence',
      'consumedAt',
      'receiptId',
      'revokedAt',
      'revokedBy',
    ] as const;
    for (const key of Object.keys(before) as (keyof EvidenceChallenge)[])
      if (
        !(mutable as readonly string[]).includes(key) &&
        JSON.stringify(before[key]) !== JSON.stringify(after[key])
      )
        throw evidenceUnavailable();
    if (
      before.state === 'CONSUMED' &&
      (JSON.stringify(before.receiptId) !== JSON.stringify(after.receiptId) ||
        JSON.stringify(before.consumedAt) !==
          JSON.stringify(after.consumedAt) ||
        after.state === 'AVAILABLE')
    )
      throw evidenceUnavailable();
    if (
      before.state === 'AVAILABLE' &&
      after.state !== 'CONSUMED' &&
      after.receiptId !== null
    )
      throw evidenceUnavailable();
    const result = await challenges().findOneAndUpdate(
      { ...before },
      { $set: Object.fromEntries(mutable.map((k) => [k, after[k]])) },
      { ...options(read), returnDocument: 'after' },
    );
    if (!result) throw new EvidenceWriteConflict();
    if (
      JSON.stringify(acknowledgementChallengeRecord.parse(result)) !==
      JSON.stringify(after)
    )
      throw evidenceUnavailable();
  },
};
function unknownCommit(error: unknown, depth = 0): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    depth < 4 &&
    (('errorLabels' in error &&
      Array.isArray(error.errorLabels) &&
      error.errorLabels.includes('UnknownTransactionCommitResult')) ||
      ('cause' in error && unknownCommit(error.cause, depth + 1)))
  );
}
function retryable(
  error: unknown,
  indexes: readonly { key: Readonly<Record<string, number>> }[],
) {
  return (
    error instanceof EvidenceWriteConflict ||
    (!!error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000 &&
      'keyPattern' in error &&
      indexes.some(
        (i) => JSON.stringify(i.key) === JSON.stringify(error.keyPattern),
      ))
  );
}
/** No existing attempt, progress, audit writer or collection provisioning is called. */
export function additionalAcknowledgementStore(
  section: 'EXAMPLE' | 'REVISE',
): EvidenceStore {
  return {
    ...mongoEvidence,
    async insertChallenge(row, read) {
      const parsed = acknowledgementChallengeRecord.parse(row);
      if (parsed.section !== section || parsed.schemaVersion !== 3)
        throw evidenceUnavailable();
      await new SectionEvidenceChallenge(parsed).save({ session: write(read) });
    },
    async insertReceipt(row, read) {
      const parsed = acknowledgementReceiptRecord.parse(row);
      if (parsed.section !== section || parsed.schemaVersion !== 3)
        throw evidenceUnavailable();
      await new SectionActivityReceipt(parsed).save({ session: write(read) });
    },
    async revision(concept, read) {
      const rows = await database()
        .collection('concepts')
        .aggregate<ProjectedConceptDetail>(
          [
            ...publishedConceptStages(concept.toHexString()),
            { $project: conceptProjection },
          ],
          options(read),
        )
        .toArray();
      if (rows.length !== 1)
        throw new AppError(404, 'CONCEPT_NOT_FOUND', 'Concept not found');
      storedConcept.parse(rows[0]);
      try {
        return additionalSectionRevision(conceptDetailDto(rows[0]!), section);
      } catch {
        throw evidenceUnavailable();
      }
    },
    async challenge(owner, identity, read) {
      const row = await challenges().findOne(
        { userId: owner, ...identity, section, schemaVersion: 3 },
        { ...options(read), projection: challengeProjection },
      );
      return row ? acknowledgementChallengeRecord.parse(row) : null;
    },
    async receipt(owner, identity, read) {
      const row = await receipts().findOne(
        { userId: owner, ...identity, section, schemaVersion: 3 },
        { ...options(read), projection: receiptProjection },
      );
      return row ? acknowledgementReceiptRecord.parse(row) : null;
    },
  };
}

/** LOCAL synthetic qualification persistence only. Native test ownership remains
 * an external integration prerequisite, never an application freshness claim. */
export const mongoQualification: QualificationStore = {
  ...mongoGrading,
  async ready(ms) {
    const started = performance.now();
    const remaining = () => {
      const value = Math.floor(ms - (performance.now() - started));
      if (value <= 0) throw evidenceUnavailable();
      return value;
    };
    await mongoGrading.ready(remaining());
    await mongoEvidence.ready(remaining());
    verifyEvidenceIndex(
      await database()
        .collection(checkpointDefinitionIndex.collection)
        .indexes({ timeoutMS: remaining() }),
      checkpointDefinitionIndex,
    );
  },
  generation() {
    const db = mongoose.connection.db;
    if (!db) throw evidenceUnavailable();
    return {
      client: mongoose.connection.getClient(),
      database: db,
      live: mongoose.connection.readyState === 1,
    };
  },
  onLoss(invalidate) {
    const connection = mongoose.connection;
    const client = connection.getClient();
    const events = [
      'disconnected',
      'disconnecting',
      'reconnected',
      'error',
      'close',
    ] as const;
    const clientEvents = [
      'connectionPoolCleared',
      'topologyClosed',
      'serverClosed',
    ] as const;
    for (const event of events) connection.on(event, invalidate);
    for (const event of clientEvents) client.on(event, invalidate);
    return () => {
      for (const event of events) connection.off(event, invalidate);
      for (const event of clientEvents) client.off(event, invalidate);
    };
  },
  async target(read) {
    const db = database(),
      client = mongoose.connection.getClient();
    if (
      db.databaseName !== 'deeplearner-f021-test' ||
      client.options.hosts?.length !== 1 ||
      client.options.hosts[0]?.toString() !== '127.0.0.1:27018' ||
      client.options.replicaSet !== 'f021-test' ||
      client.options.directConnection !== true
    )
      throw evidenceUnavailable();
    const hello = await db.admin().command({ hello: 1 }, options(read));
    if (hello.isWritablePrimary !== true || hello.setName !== 'f021-test')
      throw evidenceUnavailable();
  },
  async createSynthetic(v, read) {
    const session = write(read);
    const topic = await database()
      .collection('topics')
      .findOne(
        { _id: new Types.ObjectId(v.topicId), status: 'PUBLISHED' },
        options(read),
      );
    if (!topic) throw evidenceUnavailable();
    const refs = {
      technologyId: topic.technologyId,
      learningPathId: topic.learningPathId,
      moduleId: topic.moduleId,
      topicId: topic._id,
    };
    await new User({
      _id: new Types.ObjectId(v.userId),
      email: `synthetic-${v.userId}@example.invalid`,
      firstName: 'Synthetic',
      lastName: 'Student',
      role: 'STUDENT',
      plan: 'FREE',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      passwordHash: v.passwordHash,
      authProviders: [],
    }).save({ session });
    await new Concept({
      _id: new Types.ObjectId(v.conceptId),
      ...refs,
      title: 'Synthetic completion Concept',
      slug: `synthetic-${v.conceptId}`,
      difficulty: 'BEGINNER',
      contentFormat: 'MARKDOWN',
      read: { summary: v.summary, bodyMarkdown: v.bodyMarkdown },
      examples: [{ title: 'Example', bodyMarkdown: v.example }],
      ...(v.revise ? { revise: v.revise } : {}),
      source: {
        label: 'Synthetic local fixture',
        url: 'https://example.invalid/synthetic',
        sourceType: 'OFFICIAL_OR_TRUSTED',
        isOfficial: false,
      },
      status: 'PUBLISHED',
      createdBy: new Types.ObjectId(v.authorId),
      updatedBy: new Types.ObjectId(v.authorId),
    }).save({ session });
    await new PracticeQuestion({
      _id: new Types.ObjectId(v.questionId),
      technologyId: topic.technologyId,
      topicId: topic._id,
      conceptId: new Types.ObjectId(v.conceptId),
      type: 'OUTPUT',
      difficulty: 'BEGINNER',
      prompt: v.prompt,
      answer: v.answer,
      status: 'PUBLISHED',
      createdBy: new Types.ObjectId(v.authorId),
      updatedBy: new Types.ObjectId(v.authorId),
    }).save({ session });
  },
  async syntheticProof(v, read) {
    const user = await database()
      .collection('users')
      .findOne(
        {
          _id: new Types.ObjectId(v.userId),
          email: `synthetic-${v.userId}@example.invalid`,
          passwordHash: v.passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
        options(read),
      );
    const source = await mongoGrading.qualified(
      v.questionId,
      v.conceptId,
      read,
    );
    if (
      !user ||
      !source ||
      source.data.type !== 'OUTPUT' ||
      source.data.answer !== v.answer ||
      (await database()
        .collection('practiceAttempts')
        .findOne({ userId: new Types.ObjectId(v.userId) }, options(read)))
    )
      throw evidenceUnconfirmed();
    await mongoEvidence.revision(new Types.ObjectId(v.conceptId), read);
  },
  async conceptRevision(id, read) {
    return (await mongoEvidence.revision(new Types.ObjectId(id), read))
      .conceptRevision;
  },
  async sectionRevision(id, section, read) {
    return (
      await (
        section === 'READ'
          ? mongoEvidence
          : additionalAcknowledgementStore(section)
      ).revision(new Types.ObjectId(id), read)
    ).sectionRevision;
  },
  async actions(owner, concept, section, read) {
    const rows = await database()
      .collection('sectionActivityReceipts')
      .find(
        {
          userId: new Types.ObjectId(owner),
          conceptId: new Types.ObjectId(concept),
          section,
          purpose: 'ACTIVITY_ONLY',
        },
        options(read),
      )
      .sort({ acknowledgedAt: 1, respondedAt: 1, _id: 1 })
      .limit(33)
      .toArray();
    if (rows.length > 32) throw evidenceUnavailable();
    const result = [];
    for (const receipt of rows) {
      const challenge = await database()
        .collection('sectionEvidenceChallenges')
        .findOne(
          {
            _id: receipt.challengeId,
            userId: new Types.ObjectId(owner),
            conceptId: new Types.ObjectId(concept),
            section,
          },
          options(read),
        );
      result.push({ challenge, receipt });
    }
    return result;
  },
  async policy(id, read) {
    const row = await database()
      .collection('concepts')
      .findOne(
        { _id: new Types.ObjectId(id) },
        { ...options(read), projection: { completionRules: 1 } },
      );
    if (!row) throw evidenceUnavailable();
    return row.completionRules === undefined
      ? null
      : completionRulesFromStorage(row.completionRules);
  },
  async policyWrite(id, before, after, read) {
    write(read);
    conceptCompletionRules.parse(after);
    if (after.decisionFence !== (before?.decisionFence ?? 0) + 1)
      throw evidenceUnavailable();
    const previous = before?.versions ?? [];
    if (
      after.versions.length < previous.length ||
      after.versions.length > previous.length + 1 ||
      after.versions.some((p) => p.conceptId !== id)
    )
      throw evidenceUnavailable();
    const mutable = new Set([
      'state',
      'approvedBy',
      'approvedAt',
      'approvedFingerprint',
      'revokedBy',
      'revokedAt',
    ]);
    for (let i = 0; i < previous.length; i++) {
      const p = previous[i]!,
        n = after.versions[i]!;
      if (p.state === 'REVOKED' && JSON.stringify(p) !== JSON.stringify(n))
        throw evidenceUnavailable();
      if (p.state === 'APPROVED' && n.state === 'DRAFT')
        throw evidenceUnavailable();
      for (const k of Object.keys(p) as (keyof typeof p)[]) {
        if (
          (!mutable.has(k) ||
            (p.state === 'APPROVED' &&
              ['approvedBy', 'approvedAt', 'approvedFingerprint'].includes(
                k,
              ))) &&
          JSON.stringify(p[k]) !== JSON.stringify(n[k])
        )
          throw evidenceUnavailable();
      }
    }
    if (
      after.versions.length > previous.length &&
      after.versions.at(-1)?.state !== 'DRAFT'
    )
      throw evidenceUnavailable();
    const result = await database()
      .collection('concepts')
      .updateOne(
        {
          _id: new Types.ObjectId(id),
          ...(before
            ? { completionRules: completionRulesToStorage(before) }
            : { completionRules: { $exists: false } }),
        },
        { $set: { completionRules: completionRulesToStorage(after) } },
        options(read),
      );
    if (result.matchedCount !== 1) throw new GradingWriteConflict();
  },
};

export function createSectionEvidenceRepository(
  store: EvidenceStore = mongoEvidence,
  clock = () => performance.now(),
  uniqueIndexes: readonly {
    key: Readonly<Record<string, number>>;
  }[] = evidenceIndexes,
) {
  return {
    store,
    async transact<T>(
      work: (read: EvidenceRead) => Promise<T>,
      prove: (value: T, read: EvidenceRead) => Promise<void>,
      before: (read: EvidenceRead) => Promise<void>,
    ): Promise<T> {
      const start = clock();
      const remaining = () => {
        const n = Math.floor(10_000 - (clock() - start));
        if (n <= 0) throw evidenceUnavailable();
        return n;
      };
      let session: ClientSession | undefined,
        candidate: T | undefined,
        committed = false,
        failure: AppError | undefined,
        bodies = 0;
      try {
        await store.ready(remaining());
        session = await store.session();
        const proofRead: EvidenceRead = {
          session,
          get timeoutMS() {
            return remaining();
          },
          majority: true,
        };
        await before(proofRead);
        while (!committed && bodies < 3) {
          const budget = remaining() - 2000;
          if (budget <= 0) throw evidenceUnavailable();
          try {
            await session.withTransaction(
              async () => {
                if (++bodies > 3 || remaining() <= 2000)
                  throw evidenceUnavailable();
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
          } catch (e) {
            if (unknownCommit(e)) throw evidenceUnconfirmed();
            if (retryable(e, uniqueIndexes) && bodies < 3) continue;
            throw e;
          }
        }
        if (!committed || candidate === undefined) throw evidenceUnconfirmed();
        await store.ready(remaining());
        await prove(candidate, proofRead);
        remaining();
      } catch (e) {
        failure =
          e instanceof AppError
            ? e
            : committed
              ? evidenceUnconfirmed()
              : evidenceUnavailable();
      } finally {
        if (session)
          try {
            await session.endSession();
          } catch {
            failure ??= evidenceUnconfirmed();
          }
      }
      if (failure) throw failure;
      if (candidate === undefined) throw evidenceUnconfirmed();
      return candidate;
    },
  };
}
export type SectionEvidenceRepository = ReturnType<
  typeof createSectionEvidenceRepository
>;
