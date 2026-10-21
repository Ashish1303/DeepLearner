import { Schema } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import {
  gradingDigest,
  gradingReference,
  gradingSchemaOptions,
  positiveVersion,
} from './practice-rubric.model.js';

export const assessmentRecord = z
  .strictObject({
    _id: gradingReference,
    userId: gradingReference,
    attemptId: gradingReference,
    questionId: gradingReference,
    conceptId: gradingReference,
    type: z.literal('OUTPUT'),
    questionRevision: gradingDigest,
    contentFingerprint: gradingDigest,
    attemptRequestFingerprint: gradingDigest,
    rubricId: gradingReference,
    rubricVersion: positiveVersion,
    rubricDefinitionFingerprint: gradingDigest,
    graderId: z.literal('OUTPUT_EXACT_TEXT'),
    graderVersion: z.literal(1),
    purpose: z.literal('DIAGNOSTIC'),
    outcome: z.enum(['CORRECT', 'INCORRECT', 'REFUSED']),
    score: z.union([z.literal(0), z.literal(100), z.null()]),
    refusalCode: z.literal('INVALID_ANSWER').nullable(),
    evaluatedAt: z.date(),
    requestedBy: gradingReference,
    authorityId: gradingReference,
    reviewerId: gradingReference,
    approvalAuditId: gradingReference,
    authorizationFence: positiveVersion,
    requestFingerprint: gradingDigest,
    schemaVersion: z.literal(1),
  })
  .refine(
    (r) =>
      r.userId.equals(r.requestedBy) &&
      (r.outcome === 'CORRECT'
        ? r.score === 100 && r.refusalCode === null
        : r.outcome === 'INCORRECT'
          ? r.score === 0 && r.refusalCode === null
          : r.score === null && r.refusalCode === 'INVALID_ANSWER'),
  );
export type AssessmentRecord = z.output<typeof assessmentRecord>;
export const completionAssessmentRecord = z
  .strictObject({
    ...assessmentRecord.shape,
    purpose: z.literal('COMPLETION_INPUT'),
    graderId: z.literal('OUTPUT_EXACT_TEXT_COMPLETION'),
    schemaVersion: z.literal(2),
    outcome: z.enum(['CORRECT', 'INCORRECT']),
    score: z.union([z.literal(0), z.literal(100)]),
    refusalCode: z.null(),
    policyId: gradingReference,
    policyVersion: positiveVersion,
    policyFingerprint: gradingDigest,
    sourceEpoch: gradingDigest,
    submissionProvenance: z.literal('F036_FIRST_SUBMISSION_ATOMIC_V1'),
    attemptNumber: z.literal(1),
  })
  .refine(
    (r) =>
      r.userId.equals(r.requestedBy) &&
      r.score === (r.outcome === 'CORRECT' ? 100 : 0),
  );
export type CompletionAssessmentRecord = z.output<
  typeof completionAssessmentRecord
>;
type StoredAssessment = Omit<
  AssessmentRecord,
  'graderId' | 'purpose' | 'schemaVersion'
> & {
  graderId:
    AssessmentRecord['graderId'] | CompletionAssessmentRecord['graderId'];
  purpose: AssessmentRecord['purpose'] | CompletionAssessmentRecord['purpose'];
  schemaVersion: 1 | 2;
} & Partial<
    Pick<
      CompletionAssessmentRecord,
      | 'policyId'
      | 'policyVersion'
      | 'policyFingerprint'
      | 'sourceEpoch'
      | 'submissionProvenance'
      | 'attemptNumber'
    >
  >;
const storedAssessment = z.union([
  assessmentRecord,
  completionAssessmentRecord,
]);
export const assessmentIndex = {
  collection: 'practiceAssessments',
  name: 'uq_practice_assessment_identity',
  key: {
    userId: 1,
    attemptId: 1,
    rubricId: 1,
    rubricVersion: 1,
    graderId: 1,
    graderVersion: 1,
  },
  unique: true,
} as const;
const ref = {
  type: Schema.Types.ObjectId,
  required: true,
  cast: false,
  immutable: true,
};
const text = { type: String, required: true, cast: false, immutable: true };
const numeric = { type: Number, required: true, cast: false, immutable: true };
const schema = new Schema<StoredAssessment>(
  {
    _id: ref,
    userId: ref,
    attemptId: ref,
    questionId: ref,
    conceptId: ref,
    type: text,
    questionRevision: { ...text, select: false },
    contentFingerprint: { ...text, select: false },
    attemptRequestFingerprint: { ...text, select: false },
    rubricId: ref,
    rubricVersion: numeric,
    rubricDefinitionFingerprint: { ...text, select: false },
    graderId: text,
    graderVersion: numeric,
    purpose: text,
    outcome: text,
    score: { type: Number, cast: false, immutable: true, default: null },
    refusalCode: { type: String, cast: false, immutable: true, default: null },
    evaluatedAt: { type: Date, required: true, cast: false, immutable: true },
    requestedBy: ref,
    authorityId: ref,
    reviewerId: ref,
    approvalAuditId: ref,
    authorizationFence: numeric,
    requestFingerprint: { ...text, select: false },
    schemaVersion: numeric,
    policyId: { ...ref, required: false },
    policyVersion: { ...numeric, required: false },
    policyFingerprint: { ...text, required: false, select: false },
    sourceEpoch: { ...text, required: false, select: false },
    submissionProvenance: { ...text, required: false },
    attemptNumber: { ...numeric, required: false },
  },
  { ...gradingSchemaOptions, collection: 'practiceAssessments' },
);
schema.index(assessmentIndex.key, { name: assessmentIndex.name, unique: true });
schema.pre('validate', function () {
  storedAssessment.parse(
    this.toObject({ transform: false, virtuals: false, getters: false }),
  );
});
function denied(): never {
  throw new Error('Assessments are append-only');
}
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
const Model = mongoose.model<StoredAssessment>('PracticeAssessment', schema);
export class PracticeAssessment extends Model {
  constructor(row: StoredAssessment) {
    super(storedAssessment.parse(row));
  }
}
