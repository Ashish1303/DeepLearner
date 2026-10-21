import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import {
  evidenceCorrelation,
  evidenceDigest,
  evidenceLifetime,
  evidencePolicy,
} from './section-evidence-revision.js';

export const evidenceReference = z.instanceof(Types.ObjectId);
export const evidenceDate = z.date().refine((d) => d.getTime() >= 0);
export const evidenceBindings = {
  userId: evidenceReference,
  conceptId: evidenceReference,
  section: z.literal(evidencePolicy.section),
  policyId: z.literal(evidencePolicy.policyId),
  policyVersion: z.literal(1),
  producerVersion: z.literal(1),
  schemaVersion: z.literal(1),
  conceptRevision: evidenceDigest,
  sectionRevision: evidenceDigest,
};
const challengeStructure = z.strictObject({
  _id: evidenceReference,
  ...evidenceBindings,
  issueKeyHash: evidenceDigest,
  requestFingerprint: evidenceDigest,
  issueRequestId: evidenceCorrelation,
  issuedAt: evidenceDate,
  expiresAt: evidenceDate,
  state: z.enum(['AVAILABLE', 'CONSUMED', 'REVOKED']),
  decisionFence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  consumedAt: evidenceDate.nullable(),
  receiptId: evidenceReference.nullable(),
  revokedAt: evidenceDate.nullable(),
  revokedBy: evidenceReference.nullable(),
});
function validChallengeLifecycle(
  r: Pick<
    z.output<typeof challengeStructure>,
    | 'consumedAt'
    | 'receiptId'
    | 'revokedAt'
    | 'revokedBy'
    | 'userId'
    | 'issuedAt'
    | 'expiresAt'
    | 'state'
  >,
) {
  const consumed = r.consumedAt !== null && r.receiptId !== null;
  const empty = r.consumedAt === null && r.receiptId === null;
  const revoked =
    r.revokedAt !== null &&
    r.revokedBy !== null &&
    r.revokedBy.equals(r.userId) &&
    r.revokedAt >= r.issuedAt &&
    (!r.consumedAt || r.revokedAt >= r.consumedAt);
  return (
    r.expiresAt.getTime() - r.issuedAt.getTime() === evidenceLifetime &&
    (empty ||
      (consumed &&
        r.consumedAt! >= r.issuedAt &&
        r.consumedAt! < r.expiresAt)) &&
    (r.state === 'REVOKED'
      ? revoked
      : r.revokedAt === null && r.revokedBy === null) &&
    (r.state === 'AVAILABLE' ? empty : r.state === 'CONSUMED' ? consumed : true)
  );
}
export const challengeRecord = challengeStructure.refine(
  validChallengeLifecycle,
);
// F038 Section 30.3, explicitly assigned to Slice 1 in Section 30.10.
// Original READ v1 and VISUALIZE v2 parsers remain separate and unchanged.
const additionalChallenge = challengeStructure
  .extend({
    section: z.enum(['EXAMPLE', 'REVISE']),
    schemaVersion: z.literal(3),
    policyId: z.enum(['F038_EXAMPLE_ACK_ACTIVITY', 'F038_REVISE_ACK_ACTIVITY']),
  })
  .refine(validChallengeLifecycle)
  .refine((r) => r.policyId === `F038_${r.section}_ACK_ACTIVITY`);
export const acknowledgementChallengeRecord = z.union([
  challengeRecord,
  additionalChallenge,
]);
export type EvidenceChallenge = z.output<typeof acknowledgementChallengeRecord>;
export const visualCheckpointBindings = {
  section: z.literal('VISUALIZE'),
  schemaVersion: z.literal(2),
  policyId: z.literal('F038_VISUALIZE_CHECKPOINT_ACTIVITY'),
  definitionId: evidenceReference,
  definitionFingerprint: evidenceDigest,
  visualizationId: evidenceReference,
  visualizationRevision: evidenceDigest,
  checkpointId: z
    .string()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}(?![\s\S])/),
  checkpointVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  verifierVersion: z.literal(1),
};
export const visualChallengeRecord = z
  .strictObject({ ...challengeStructure.shape, ...visualCheckpointBindings })
  .refine(validChallengeLifecycle)
  .refine((r) => r.sectionRevision === r.visualizationRevision);
export type VisualChallenge = z.output<typeof visualChallengeRecord>;
const storedChallengeRecord = z.union([
  acknowledgementChallengeRecord,
  visualChallengeRecord,
]);
// A single storage document type; strict union validation enforces each branch.
type StoredChallenge = Omit<
  EvidenceChallenge,
  'section' | 'schemaVersion' | 'policyId'
> & {
  section: EvidenceChallenge['section'] | VisualChallenge['section'];
  schemaVersion: 1 | 2 | 3;
  policyId: EvidenceChallenge['policyId'] | VisualChallenge['policyId'];
} & Partial<Omit<VisualChallenge, keyof EvidenceChallenge>>;
export const challengeIndex = {
  collection: 'sectionEvidenceChallenges',
  name: 'uq_section_evidence_issue_key',
  key: { userId: 1, issueKeyHash: 1 },
  unique: true,
} as const;
export const evidenceSchemaOptions = {
  strict: 'throw',
  versionKey: false,
  autoCreate: false,
  autoIndex: false,
  bufferCommands: false,
} as const;
export const evidenceRefField = {
  type: Schema.Types.ObjectId,
  required: true,
  cast: false,
  immutable: true,
} as const;
export const evidenceTextField = {
  type: String,
  required: true,
  cast: false,
  immutable: true,
} as const;
export const evidenceNumberField = {
  type: Number,
  required: true,
  cast: false,
  immutable: true,
} as const;
export const evidenceDateField = {
  type: Date,
  required: true,
  cast: false,
  immutable: true,
} as const;
export function guardEvidenceWrites<T extends object>(schema: Schema<T>) {
  const denied = () => {
    throw new Error('Use the owned evidence repository');
  };
  schema.pre('save', function () {
    if (!this.isNew) denied();
  });
  for (const op of [
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ] as const)
    schema.pre(op, denied);
  schema.pre('deleteOne', { document: true, query: false }, denied);
  schema.pre('bulkWrite', denied);
  schema.pre('insertMany', denied);
}
export const visualCheckpointFields = {
  definitionId: { ...evidenceRefField, required: false },
  definitionFingerprint: {
    ...evidenceTextField,
    required: false,
    select: false,
  },
  visualizationId: { ...evidenceRefField, required: false },
  visualizationRevision: {
    ...evidenceTextField,
    required: false,
    select: false,
  },
  checkpointId: { ...evidenceTextField, required: false },
  checkpointVersion: { ...evidenceNumberField, required: false },
  verifierVersion: { ...evidenceNumberField, required: false },
};
const schema = new Schema<StoredChallenge>(
  {
    _id: evidenceRefField,
    userId: evidenceRefField,
    conceptId: evidenceRefField,
    section: evidenceTextField,
    policyId: evidenceTextField,
    policyVersion: evidenceNumberField,
    producerVersion: evidenceNumberField,
    schemaVersion: evidenceNumberField,
    conceptRevision: { ...evidenceTextField, select: false },
    sectionRevision: { ...evidenceTextField, select: false },
    issueKeyHash: { ...evidenceTextField, select: false },
    requestFingerprint: { ...evidenceTextField, select: false },
    issueRequestId: evidenceTextField,
    issuedAt: evidenceDateField,
    expiresAt: evidenceDateField,
    state: { type: String, required: true, cast: false },
    decisionFence: { type: Number, required: true, cast: false },
    consumedAt: { type: Date, cast: false, default: null },
    receiptId: { type: Schema.Types.ObjectId, cast: false, default: null },
    revokedAt: { type: Date, cast: false, default: null },
    revokedBy: { type: Schema.Types.ObjectId, cast: false, default: null },
    ...visualCheckpointFields,
  },
  { ...evidenceSchemaOptions, collection: challengeIndex.collection },
);
schema.index(challengeIndex.key, { name: challengeIndex.name, unique: true });
schema.pre('validate', function () {
  storedChallengeRecord.parse(
    this.toObject({ transform: false, virtuals: false, getters: false }),
  );
});
guardEvidenceWrites(schema);
const Model = mongoose.model<StoredChallenge>(
  'SectionEvidenceChallenge',
  schema,
);
export class SectionEvidenceChallenge extends Model {
  constructor(row: StoredChallenge) {
    super(storedChallengeRecord.parse(row));
  }
}
