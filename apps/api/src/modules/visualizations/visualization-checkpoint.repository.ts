import { Types } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import {
  createSectionEvidenceRepository,
  mongoEvidence,
  evidenceIndexes,
  verifyEvidenceIndex,
  evidenceUnavailable,
  EvidenceWriteConflict,
  type EvidenceRead,
  type EvidenceStore,
} from '../progress/section-evidence.repository.js';
import {
  SectionEvidenceChallenge,
  visualChallengeRecord,
  type VisualChallenge,
} from '../progress/section-evidence-challenge.model.js';
import {
  SectionActivityReceipt,
  visualReceiptRecord,
  type VisualReceipt,
} from '../progress/section-evidence-receipt.model.js';
import {
  checkpointDefinitionIndex,
  checkpointDefinitionRecord,
  VisualizationCheckpointDefinition,
  type CheckpointDefinition,
} from './visualization-checkpoint-definition.model.js';
import {
  checkpointVisualizationRevision,
  sameCheckpointData as same,
} from './visualization-checkpoint-revision.js';

export const checkpointHidden = () =>
  new AppError(
    404,
    'VISUALIZATION_CHECKPOINT_NOT_FOUND',
    'Checkpoint not found',
  );
export const checkpointConflict = () =>
  new AppError(
    409,
    'VISUALIZATION_CHECKPOINT_CONFLICT',
    'Checkpoint identity conflicts',
  );
export const checkpointLimit = () =>
  new AppError(
    429,
    'VISUALIZATION_CHECKPOINT_LIMIT',
    'Checkpoint issue limit reached',
  );
export const checkpointIndexes = [
  checkpointDefinitionIndex,
  ...evidenceIndexes,
] as const;
export interface CheckpointStore extends EvidenceStore {
  admin(id: Types.ObjectId, read: EvidenceRead): Promise<void>;
  source(
    concept: Types.ObjectId,
    visualization: Types.ObjectId,
    read: EvidenceRead,
  ): Promise<{ conceptRevision: string; visualizationRevision: string }>;
  definition(
    identity:
      | { _id: Types.ObjectId }
      | {
          visualizationId: Types.ObjectId;
          checkpointId: string;
          checkpointVersion: number;
        },
    read: EvidenceRead,
  ): Promise<CheckpointDefinition | null>;
  insertDefinition(
    row: CheckpointDefinition,
    read: EvidenceRead,
  ): Promise<void>;
  fenceDefinition(
    before: CheckpointDefinition,
    after: CheckpointDefinition,
    read: EvidenceRead,
  ): Promise<void>;
  visualChallenge(
    owner: Types.ObjectId,
    identity: { _id: Types.ObjectId } | { issueKeyHash: string },
    read: EvidenceRead,
  ): Promise<VisualChallenge | null>;
  visualReceipt(
    owner: Types.ObjectId,
    identity: { _id: Types.ObjectId } | { ackKeyHash: string },
    read: EvidenceRead,
  ): Promise<VisualReceipt | null>;
  issues(
    owner: Types.ObjectId,
    definition: Types.ObjectId,
    read: EvidenceRead,
  ): Promise<VisualChallenge[]>;
  insertVisualChallenge(
    row: VisualChallenge,
    read: EvidenceRead,
  ): Promise<void>;
  insertVisualReceipt(row: VisualReceipt, read: EvidenceRead): Promise<void>;
  fenceVisual(
    before: VisualChallenge,
    after: VisualChallenge,
    read: EvidenceRead,
  ): Promise<void>;
}
function db() {
  if (!mongoose.connection.db) throw evidenceUnavailable();
  return mongoose.connection.db;
}
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
const definitionProjection = Object.fromEntries(
  Object.keys(VisualizationCheckpointDefinition.schema.paths).map((k) => [
    k,
    1,
  ]),
);
const challengeProjection = Object.fromEntries(
  Object.keys(SectionEvidenceChallenge.schema.paths).map((k) => [k, 1]),
);
const receiptProjection = Object.fromEntries(
  Object.keys(SectionActivityReceipt.schema.paths).map((k) => [k, 1]),
);
const definitions = () =>
  db().collection<CheckpointDefinition>(checkpointDefinitionIndex.collection);
const challenges = () =>
  db().collection<VisualChallenge>('sectionEvidenceChallenges');
const receipts = () =>
  db().collection<VisualReceipt>('sectionActivityReceipts');
const visualScope = { section: 'VISUALIZE', schemaVersion: 2 } as const;
export function validateDefinitionTransition(
  before: CheckpointDefinition,
  after: CheckpointDefinition,
) {
  checkpointDefinitionRecord.parse(before);
  checkpointDefinitionRecord.parse(after);
  const mutable = [
    'state',
    'decisionFence',
    'approvedBy',
    'approvedAt',
    'approvedFingerprint',
    'revokedBy',
    'revokedAt',
  ];
  if (
    before.state === 'REVOKED' ||
    before.decisionFence >= Number.MAX_SAFE_INTEGER ||
    after.decisionFence !== before.decisionFence + 1
  )
    throw evidenceUnavailable();
  for (const key of Object.keys(before) as (keyof CheckpointDefinition)[])
    if (!mutable.includes(key) && !same(before[key], after[key]))
      throw evidenceUnavailable();
  if (
    before.state === 'APPROVED' &&
    (after.state === 'DRAFT' ||
      !same(before.approvedBy, after.approvedBy) ||
      !same(before.approvedAt, after.approvedAt) ||
      before.approvedFingerprint !== after.approvedFingerprint)
  )
    throw evidenceUnavailable();
  if (
    before.state === 'DRAFT' &&
    after.state === 'REVOKED' &&
    (after.approvedBy !== null ||
      after.approvedAt !== null ||
      after.approvedFingerprint !== null)
  )
    throw evidenceUnavailable();
}
export function validateVisualTransition(
  before: VisualChallenge,
  after: VisualChallenge,
) {
  visualChallengeRecord.parse(before);
  visualChallengeRecord.parse(after);
  const mutable = [
    'state',
    'decisionFence',
    'consumedAt',
    'receiptId',
    'revokedAt',
    'revokedBy',
  ];
  if (
    before.state === 'REVOKED' ||
    before.decisionFence >= Number.MAX_SAFE_INTEGER ||
    after.decisionFence !== before.decisionFence + 1
  )
    throw evidenceUnavailable();
  for (const key of Object.keys(before) as (keyof VisualChallenge)[])
    if (!mutable.includes(key) && !same(before[key], after[key]))
      throw evidenceUnavailable();
  if (
    before.state === 'CONSUMED' &&
    (after.state === 'AVAILABLE' ||
      !same(before.receiptId, after.receiptId) ||
      !same(before.consumedAt, after.consumedAt))
  )
    throw evidenceUnavailable();
}
export const mongoCheckpoint: CheckpointStore = {
  ...mongoEvidence,
  async ready(timeoutMS) {
    const start = performance.now();
    await mongoEvidence.ready(timeoutMS);
    const remaining = () => {
      const ms = Math.floor(timeoutMS - (performance.now() - start));
      if (ms <= 0) throw evidenceUnavailable();
      return ms;
    };
    const collection = checkpointDefinitionIndex.collection;
    const rows = await db()
      .listCollections(
        { name: collection },
        { nameOnly: false, timeoutMS: remaining() },
      )
      .toArray();
    if (
      rows.length !== 1 ||
      rows[0]!.type !== 'collection' ||
      rows[0]!.options?.collation
    )
      throw evidenceUnavailable();
    const indexes = await db()
      .collection(collection)
      .indexes({ timeoutMS: remaining() });
    // The exact verifier has the same shape for both index sets.
    verifyEvidenceIndex(indexes, checkpointDefinitionIndex);
    if (!indexes.some((i) => i.name === '_id_' && same(i.key, { _id: 1 })))
      throw evidenceUnavailable();
  },
  async admin(id, read) {
    const actor = await db()
      .collection('users')
      .findOne(
        { _id: id },
        {
          ...options(read),
          projection: { _id: 1, role: 1, status: 1, emailVerifiedAt: 1 },
        },
      );
    if (
      !actor ||
      !actor._id.equals(id) ||
      actor.role !== 'ADMIN' ||
      actor.status !== 'ACTIVE' ||
      !(actor.emailVerifiedAt instanceof Date) ||
      !Number.isFinite(actor.emailVerifiedAt.getTime())
    )
      throw new AppError(
        403,
        'AUTH_FORBIDDEN',
        'Current eligible Admin required',
      );
  },
  async source(concept, visualization, read) {
    const revision = await mongoEvidence.revision(concept, read);
    const scope = await db()
      .collection('concepts')
      .findOne(
        { _id: concept },
        {
          ...options(read),
          projection: { _id: 1, topicId: 1, technologyId: 1 },
        },
      );
    if (
      !scope ||
      !(scope.topicId instanceof Types.ObjectId) ||
      !(scope.technologyId instanceof Types.ObjectId)
    )
      throw evidenceUnavailable();
    const row = await db()
      .collection('visualizations')
      .findOne(
        { _id: visualization, conceptId: concept, status: 'PUBLISHED' },
        {
          ...options(read),
          projection: {
            _id: 1,
            conceptId: 1,
            technologyId: 1,
            topicId: 1,
            type: 1,
            title: 1,
            textAlternative: 1,
            nodes: 1,
            edges: 1,
            steps: 1,
            animationConfig: 1,
            schemaVersion: 1,
            status: 1,
            createdBy: 1,
            updatedBy: 1,
          },
        },
      );
    if (!row) throw checkpointHidden();
    try {
      return {
        conceptRevision: revision.conceptRevision,
        visualizationRevision: await checkpointVisualizationRevision(row, {
          conceptId: concept,
          topicId: scope.topicId,
          technologyId: scope.technologyId,
        }),
      };
    } catch {
      throw evidenceUnavailable();
    }
  },
  async definition(identity, read) {
    const r = await definitions().findOne(identity, {
      ...options(read),
      projection: definitionProjection,
    });
    return r ? checkpointDefinitionRecord.parse(r) : null;
  },
  async insertDefinition(row, read) {
    await new VisualizationCheckpointDefinition(row).save({
      session: write(read),
    });
  },
  async fenceDefinition(before, after, read) {
    write(read);
    validateDefinitionTransition(before, after);
    const keys = [
      'state',
      'decisionFence',
      'approvedBy',
      'approvedAt',
      'approvedFingerprint',
      'revokedBy',
      'revokedAt',
    ] as const;
    const row = await definitions().findOneAndUpdate(
      { ...before },
      { $set: Object.fromEntries(keys.map((k) => [k, after[k]])) },
      { ...options(read), returnDocument: 'after' },
    );
    if (!row) throw new EvidenceWriteConflict();
    if (!same(checkpointDefinitionRecord.parse(row), after))
      throw evidenceUnavailable();
  },
  async visualChallenge(owner, identity, read) {
    const r = await challenges().findOne(
      { userId: owner, ...identity, ...visualScope },
      { ...options(read), projection: challengeProjection },
    );
    return r ? visualChallengeRecord.parse(r) : null;
  },
  async visualReceipt(owner, identity, read) {
    const r = await receipts().findOne(
      { userId: owner, ...identity, ...visualScope },
      { ...options(read), projection: receiptProjection },
    );
    return r ? visualReceiptRecord.parse(r) : null;
  },
  async issues(owner, definitionId, read) {
    return (
      await challenges()
        .find(
          { userId: owner, definitionId, ...visualScope },
          { ...options(read), projection: challengeProjection },
        )
        .limit(4)
        .toArray()
    ).map((r) => visualChallengeRecord.parse(r));
  },
  async insertVisualChallenge(row, read) {
    await new SectionEvidenceChallenge(visualChallengeRecord.parse(row)).save({
      session: write(read),
    });
  },
  async insertVisualReceipt(row, read) {
    await new SectionActivityReceipt(visualReceiptRecord.parse(row)).save({
      session: write(read),
    });
  },
  async fenceVisual(before, after, read) {
    write(read);
    validateVisualTransition(before, after);
    const keys = [
      'state',
      'decisionFence',
      'consumedAt',
      'receiptId',
      'revokedAt',
      'revokedBy',
    ] as const;
    const row = await challenges().findOneAndUpdate(
      { ...before },
      { $set: Object.fromEntries(keys.map((k) => [k, after[k]])) },
      { ...options(read), returnDocument: 'after' },
    );
    if (!row) throw new EvidenceWriteConflict();
    if (!same(visualChallengeRecord.parse(row), after))
      throw evidenceUnavailable();
  },
};
export function createCheckpointRepository(
  store: CheckpointStore = mongoCheckpoint,
  clock = () => performance.now(),
) {
  return {
    ...createSectionEvidenceRepository(store, clock, checkpointIndexes),
    store,
  };
}
export type CheckpointRepository = ReturnType<
  typeof createCheckpointRepository
>;
