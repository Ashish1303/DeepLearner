import { Schema } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import {
  evidenceCorrelation,
  evidenceDigest,
} from './section-evidence-revision.js';
import {
  evidenceBindings,
  evidenceDate,
  evidenceReference,
  evidenceSchemaOptions,
  evidenceRefField,
  evidenceTextField,
  evidenceNumberField,
  evidenceDateField,
  guardEvidenceWrites,
  visualCheckpointBindings,
  visualCheckpointFields,
} from './section-evidence-challenge.model.js';

export const receiptRecord = z.strictObject({
  _id: evidenceReference,
  ...evidenceBindings,
  challengeId: evidenceReference,
  origin: z.literal('ACKNOWLEDGEMENT_SERVICE'),
  purpose: z.literal('ACTIVITY_ONLY'),
  ackKeyHash: evidenceDigest,
  requestFingerprint: evidenceDigest,
  ackRequestId: evidenceCorrelation,
  acknowledgedAt: evidenceDate,
});
const additionalReceipt = receiptRecord
  .extend({
    section: z.enum(['EXAMPLE', 'REVISE']),
    schemaVersion: z.literal(3),
    policyId: z.enum(['F038_EXAMPLE_ACK_ACTIVITY', 'F038_REVISE_ACK_ACTIVITY']),
  })
  .refine((r) => r.policyId === `F038_${r.section}_ACK_ACTIVITY`);
export const acknowledgementReceiptRecord = z.union([
  receiptRecord,
  additionalReceipt,
]);
export type EvidenceReceipt = z.output<typeof acknowledgementReceiptRecord>;
export const visualReceiptRecord = receiptRecord
  .omit({ acknowledgedAt: true })
  .extend({
    ...visualCheckpointBindings,
    origin: z.literal('CHECKPOINT_SERVICE'),
    respondedAt: evidenceDate,
    outcome: z.enum(['CORRECT', 'INCORRECT']),
  })
  .refine((r) => r.sectionRevision === r.visualizationRevision);
export type VisualReceipt = z.output<typeof visualReceiptRecord>;
const storedReceiptRecord = z.union([
  acknowledgementReceiptRecord,
  visualReceiptRecord,
]);
type StoredReceipt = Omit<
  EvidenceReceipt,
  'section' | 'schemaVersion' | 'policyId' | 'origin' | 'acknowledgedAt'
> & {
  section: EvidenceReceipt['section'] | VisualReceipt['section'];
  schemaVersion: 1 | 2 | 3;
  policyId: EvidenceReceipt['policyId'] | VisualReceipt['policyId'];
  origin: EvidenceReceipt['origin'] | VisualReceipt['origin'];
  acknowledgedAt?: Date;
} & Partial<Omit<VisualReceipt, keyof EvidenceReceipt>>;
export const receiptIndexes = [
  {
    collection: 'sectionActivityReceipts',
    name: 'uq_section_activity_challenge',
    key: { userId: 1, challengeId: 1 },
    unique: true,
  },
  {
    collection: 'sectionActivityReceipts',
    name: 'uq_section_activity_ack_key',
    key: { userId: 1, ackKeyHash: 1 },
    unique: true,
  },
] as const;
const schema = new Schema<StoredReceipt>(
  {
    _id: evidenceRefField,
    userId: evidenceRefField,
    conceptId: evidenceRefField,
    challengeId: evidenceRefField,
    section: evidenceTextField,
    policyId: evidenceTextField,
    policyVersion: evidenceNumberField,
    producerVersion: evidenceNumberField,
    schemaVersion: evidenceNumberField,
    conceptRevision: { ...evidenceTextField, select: false },
    sectionRevision: { ...evidenceTextField, select: false },
    origin: evidenceTextField,
    purpose: evidenceTextField,
    ackKeyHash: { ...evidenceTextField, select: false },
    requestFingerprint: { ...evidenceTextField, select: false },
    ackRequestId: evidenceTextField,
    acknowledgedAt: { ...evidenceDateField, required: false },
    respondedAt: { ...evidenceDateField, required: false },
    outcome: { ...evidenceTextField, required: false },
    ...visualCheckpointFields,
  },
  { ...evidenceSchemaOptions, collection: 'sectionActivityReceipts' },
);
for (const i of receiptIndexes)
  schema.index(i.key, { name: i.name, unique: true });
schema.pre('validate', function () {
  storedReceiptRecord.parse(
    this.toObject({ transform: false, virtuals: false, getters: false }),
  );
});
guardEvidenceWrites(schema);
const Model = mongoose.model<StoredReceipt>('SectionActivityReceipt', schema);
export class SectionActivityReceipt extends Model {
  constructor(row: z.output<typeof storedReceiptRecord>) {
    super(storedReceiptRecord.parse(row));
  }
}
