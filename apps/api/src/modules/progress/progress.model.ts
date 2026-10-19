import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
const reference = z.instanceof(Types.ObjectId);
export const progressRecord = z
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
export type ProgressRecord = z.output<typeof progressRecord>;
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
const schema = new Schema<ProgressRecord>(
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
const Model = mongoose.model<ProgressRecord>('StudentProgress', schema);
export class StudentProgress extends Model {
  constructor(input: ProgressRecord) {
    super(progressRecord.parse(input));
  }
}
