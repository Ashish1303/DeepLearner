import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import { submittedAnswer } from './practice.schema.js';

const reference = z.instanceof(Types.ObjectId);
const digest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const attemptRecord = z.strictObject({
  _id: reference,
  userId: reference,
  questionId: reference,
  conceptId: reference,
  type: z.enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']),
  questionRevision: digest,
  contentFingerprint: digest,
  attemptNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  studentAnswer: submittedAnswer,
  submittedAt: z.date(),
  result: z.literal('SUBMITTED'),
  score: z.null(),
  idempotencyKeyHash: digest,
  requestFingerprint: digest,
  schemaVersion: z.literal(1),
});
export type AttemptRecord = z.output<typeof attemptRecord>;
export const attemptIndexes = [
  {
    key: { userId: 1, questionId: 1, attemptNumber: 1 },
    name: 'uq_practice_attempt_sequence',
    unique: true,
  },
  {
    key: { userId: 1, idempotencyKeyHash: 1 },
    name: 'uq_practice_attempt_idempotency',
    unique: true,
  },
  {
    key: { userId: 1, conceptId: 1, submittedAt: -1 },
    name: 'ix_practice_attempt_owner_concept_time',
    unique: false,
  },
  {
    key: { conceptId: 1, submittedAt: -1 },
    name: 'ix_practice_attempt_concept_time',
    unique: false,
  },
] as const;
const oid = { type: Schema.Types.ObjectId, required: true, cast: false };
const hash = { type: String, required: true, cast: false, select: false };
export const practiceAttemptSchema = new Schema<AttemptRecord>(
  {
    _id: oid,
    userId: oid,
    questionId: oid,
    conceptId: oid,
    type: { type: String, required: true, cast: false },
    questionRevision: hash,
    contentFingerprint: hash,
    attemptNumber: { type: Number, required: true, cast: false },
    studentAnswer: { type: String, required: true, cast: false, select: false },
    submittedAt: { type: Date, required: true, cast: false },
    result: { type: String, required: true, cast: false },
    score: { type: Number, cast: false },
    idempotencyKeyHash: hash,
    requestFingerprint: hash,
    schemaVersion: { type: Number, required: true, cast: false },
  },
  {
    collection: 'practiceAttempts',
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
practiceAttemptSchema.pre('validate', function () {
  attemptRecord.parse(
    this.toObject({ getters: false, virtuals: false, transform: false }),
  );
});
function immutable(): never {
  throw new Error('Practice attempts are insert-only');
}
practiceAttemptSchema.pre('save', function () {
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
  practiceAttemptSchema.pre(operation, immutable);
practiceAttemptSchema.pre(
  'deleteOne',
  { document: true, query: false },
  immutable,
);
practiceAttemptSchema.pre('bulkWrite', immutable);
practiceAttemptSchema.pre('insertMany', immutable);
for (const index of attemptIndexes)
  practiceAttemptSchema.index(index.key, {
    name: index.name,
    unique: index.unique,
  });
const Model = mongoose.model<AttemptRecord>(
  'PracticeAttempt',
  practiceAttemptSchema,
);
export class PracticeAttempt extends Model {
  constructor(input: AttemptRecord) {
    if (
      !input ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      Reflect.ownKeys(input).some(
        (key) =>
          typeof key !== 'string' ||
          !('value' in Object.getOwnPropertyDescriptor(input, key)!),
      )
    )
      throw new Error('Invalid attempt input');
    super(attemptRecord.parse(input));
  }
}
