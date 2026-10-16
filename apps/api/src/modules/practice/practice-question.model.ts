import { Schema, Types, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

const rootKeys = [
  '_id',
  'technologyId',
  'topicId',
  'conceptId',
  'type',
  'difficulty',
  'prompt',
  'answer',
  'explanation',
  'starterCode',
  'language',
  'status',
  'schemaVersion',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  '__v',
];

// Inspect before Mongoose can ignore keys or invoke supplied accessors.
function objectInput(value: unknown) {
  if (value === undefined) return;
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new mongoose.Error.CastError('Object', value, 'practiceQuestion');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      typeof key !== 'string' ||
      !rootKeys.includes(key) ||
      !('value' in descriptor)
    )
      throw new mongoose.Error.StrictModeError(
        'practiceQuestion.' + String(key),
      );
  }
}
function objectId(value: unknown) {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && /^[a-fA-F0-9]{24}(?![\s\S])/.test(value))
    return new Types.ObjectId(value);
  throw new mongoose.Error.CastError('ObjectId', value, 'reference');
}
function reference(ref: string) {
  return { type: Schema.Types.ObjectId, ref, required: true, cast: objectId };
}
function text(required: boolean, code = false) {
  return {
    type: String,
    cast: false,
    required,
    trim: !code,
    minlength: 1,
    maxlength: 50000,
    validate: (value: unknown) =>
      value === undefined ||
      (code && value === null) ||
      (typeof value === 'string' && value.trim().length > 0),
  };
}
function dateInput(value: unknown) {
  if (value === undefined) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  throw new mongoose.Error.CastError('Date', value, 'timestamp');
}

export const practiceQuestionSchema = new Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      auto: true,
      required: true,
      cast: objectId,
    },
    technologyId: reference('Technology'),
    topicId: reference('Topic'),
    conceptId: reference('Concept'),
    type: {
      type: String,
      cast: false,
      required: true,
      enum: ['CODING', 'OUTPUT', 'DESCRIPTIVE', 'SCENARIO'],
    },
    difficulty: {
      type: String,
      cast: false,
      required: true,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'],
    },
    prompt: text(true),
    answer: { ...text(true), select: false },
    explanation: { ...text(false), select: false },
    starterCode: text(false, true),
    language: {
      type: String,
      cast: false,
      enum: ['JAVASCRIPT', 'TYPESCRIPT', null],
    },
    status: {
      type: String,
      cast: false,
      required: true,
      default: 'DRAFT',
      enum: [
        'DRAFT',
        'AI_GENERATED',
        'IN_REVIEW',
        'CHANGES_REQUIRED',
        'APPROVED',
        'PUBLISHED',
        'ARCHIVED',
      ],
    },
    schemaVersion: {
      type: Number,
      cast: false,
      required: true,
      default: 1,
      enum: [1],
    },
    createdBy: reference('User'),
    updatedBy: reference('User'),
    createdAt: { type: Date, set: dateInput },
    updatedAt: { type: Date, set: dateInput },
  },
  {
    collection: 'practiceQuestions',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);

// Whole-document rule: use async validate()/validated save, not query/raw writes.
practiceQuestionSchema.pre('validate', function () {
  if (
    typeof this.starterCode === 'string' &&
    this.language !== 'JAVASCRIPT' &&
    this.language !== 'TYPESCRIPT'
  )
    this.invalidate('language', 'Question code requires a supported language');
});
practiceQuestionSchema.index({ conceptId: 1, status: 1, difficulty: 1 });
practiceQuestionSchema.index({ technologyId: 1, type: 1, status: 1 });
export type PracticeQuestionRecord = InferSchemaType<
  typeof practiceQuestionSchema
>;
const PracticeQuestionModel = mongoose.model(
  'PracticeQuestion',
  practiceQuestionSchema,
);

export class PracticeQuestion extends PracticeQuestionModel {
  constructor(...args: ConstructorParameters<typeof PracticeQuestionModel>) {
    objectInput(args[0]);
    super(
      args[0] as Partial<PracticeQuestionRecord> | undefined,
      args[1],
      args[2],
    );
  }
}
