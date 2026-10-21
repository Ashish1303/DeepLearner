import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
const reference = z.instanceof(Types.ObjectId);
export const progressV1Record = z
  .strictObject({
    _id: reference,
    userId: reference,
    conceptId: reference,
    technologyId: reference,
    learningPathId: reference,
    moduleId: reference,
    topicId: reference,
    attemptCount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    status: z.literal('IN_PROGRESS'),
    startedAt: z.date(),
    lastActivityAt: z.date(),
    createdAt: z.date(),
    updatedAt: z.date(),
    schemaVersion: z.literal(1),
  })
  .refine(
    (row) =>
      row.startedAt <= row.lastActivityAt && row.createdAt <= row.updatedAt,
  );
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const section = z.enum(['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE', 'REVISE']);
export const completionClaim = z
  .strictObject({
    policyId: reference,
    policyVersion: version,
    policyFingerprint: digest,
    conceptRevision: digest,
    sourceEpoch: digest,
    decisionVersion: version,
    requiredSections: z.array(section).min(4).max(5),
    sectionReceipts: z
      .array(
        z.strictObject({
          section: z.enum(['READ', 'VISUALIZE', 'EXAMPLE', 'REVISE']),
          receiptId: reference,
        }),
      )
      .min(3)
      .max(4),
    assessmentId: reference,
    attemptId: reference,
    minimumScore: z.literal(70),
    selectedScore: z.literal(100),
    requestReceiptId: reference,
  })
  .refine((c) => {
    const required = [
      'READ',
      'VISUALIZE',
      'EXAMPLE',
      'PRACTICE',
      ...(c.requiredSections.includes('REVISE') ? ['REVISE'] : []),
    ];
    return (
      JSON.stringify(c.requiredSections) === JSON.stringify(required) &&
      JSON.stringify(c.sectionReceipts.map((r) => r.section)) ===
        JSON.stringify(required.filter((s) => s !== 'PRACTICE')) &&
      new Set(c.sectionReceipts.map((r) => r.receiptId.toHexString())).size ===
        c.sectionReceipts.length
    );
  });
export type CompletionClaim = z.output<typeof completionClaim>;
const score = z.union([z.literal(0), z.literal(100), z.null()]);
export const progressV2Record = z
  .strictObject({
    ...progressV1Record.shape,
    status: z.enum(['IN_PROGRESS', 'COMPLETED']),
    schemaVersion: z.literal(2),
    sections: z.strictObject({
      readCompleted: z.boolean(),
      visualizeCompleted: z.boolean(),
      exampleCompleted: z.boolean(),
      practiceCompleted: z.boolean(),
      reviseCompleted: z.boolean(),
    }),
    firstScore: score,
    latestScore: score,
    bestScore: score,
    completedAt: z.date().nullable(),
    completion: completionClaim.nullable(),
  })
  .refine((r) => {
    if (r.startedAt > r.lastActivityAt || r.createdAt > r.updatedAt)
      return false;
    const scores = [r.firstScore, r.latestScore, r.bestScore];
    if (scores.some((s) => s === null) && !scores.every((s) => s === null))
      return false;
    if (
      r.bestScore !== null &&
      (r.bestScore < r.firstScore! || r.bestScore < r.latestScore!)
    )
      return false;
    if (!r.completion)
      return (
        r.status === 'IN_PROGRESS' &&
        r.completedAt === null &&
        Object.values(r.sections).every((v) => !v)
      );
    return (
      r.status === 'COMPLETED' &&
      r.completedAt !== null &&
      r.completedAt >= r.createdAt &&
      r.completedAt <= r.updatedAt &&
      r.firstScore !== null &&
      r.bestScore === 100 &&
      r.sections.readCompleted &&
      r.sections.visualizeCompleted &&
      r.sections.exampleCompleted &&
      r.sections.practiceCompleted &&
      r.sections.reviseCompleted ===
        r.completion.requiredSections.includes('REVISE')
    );
  });
export const progressRecord = z.union([progressV1Record, progressV2Record]);
export type ProgressRecord = z.output<typeof progressRecord>;
export type ProgressV2Record = z.output<typeof progressV2Record>;
type StoredProgress = Omit<
  z.output<typeof progressV1Record>,
  'schemaVersion' | 'status'
> & {
  schemaVersion: 1 | 2;
  status: 'IN_PROGRESS' | 'COMPLETED';
} & Partial<
    Pick<
      ProgressV2Record,
      | 'sections'
      | 'firstScore'
      | 'latestScore'
      | 'bestScore'
      | 'completedAt'
      | 'completion'
    >
  >;
export const emptyCompletionFields = () => ({
  sections: {
    readCompleted: false,
    visualizeCompleted: false,
    exampleCompleted: false,
    practiceCompleted: false,
    reviseCompleted: false,
  },
  firstScore: null,
  latestScore: null,
  bestScore: null,
  completedAt: null,
  completion: null,
});
export const progressIndex = {
  key: { userId: 1, conceptId: 1 },
  name: 'uq_student_progress_owner_concept',
  unique: true,
} as const;
const identity = {
  type: Schema.Types.ObjectId,
  required: true,
  cast: false,
  immutable: true,
};
const schema = new Schema<StoredProgress>(
  {
    _id: identity,
    userId: identity,
    conceptId: identity,
    technologyId: identity,
    learningPathId: identity,
    moduleId: identity,
    topicId: identity,
    attemptCount: { type: Number, required: true, cast: false },
    status: { type: String, required: true, cast: false },
    startedAt: { type: Date, required: true, cast: false },
    lastActivityAt: { type: Date, required: true, cast: false },
    createdAt: { type: Date, required: true, cast: false, immutable: true },
    updatedAt: { type: Date, required: true, cast: false },
    schemaVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
    sections: { type: Schema.Types.Mixed, required: false },
    firstScore: { type: Number, cast: false, required: false },
    latestScore: { type: Number, cast: false, required: false },
    bestScore: { type: Number, cast: false, required: false },
    completedAt: { type: Date, cast: false, required: false },
    completion: { type: Schema.Types.Mixed, required: false },
  },
  {
    collection: 'studentProgress',
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
schema.index(progressIndex.key, { name: progressIndex.name, unique: true });
schema.pre('validate', function () {
  progressRecord.parse(
    this.toObject({ getters: false, virtuals: false, transform: false }),
  );
});
function immutable(): never {
  throw new Error('Use the owned progress repository');
}
schema.pre('save', function () {
  if (!this.isNew) immutable();
});
for (const operation of [
  'updateOne',
  'updateMany',
  'replaceOne',
  'findOneAndUpdate',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const)
  schema.pre(operation, immutable);
schema.pre('deleteOne', { document: true, query: false }, immutable);
schema.pre('bulkWrite', immutable);
schema.pre('insertMany', immutable);
const Model = mongoose.model<StoredProgress>('StudentProgress', schema);
export class StudentProgress extends Model {
  constructor(input: ProgressRecord) {
    super(progressRecord.parse(input));
  }
}
