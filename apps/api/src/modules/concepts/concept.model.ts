import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';
const readSchema = new Schema(
  {
    summary: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    bodyMarkdown: {
      type: String,
      required: true,
      maxlength: 50000,
      validate: (value: string) => value.trim().length > 0,
    },
  },
  { _id: false, strict: 'throw' },
);
const exampleSchema = new Schema(
  {
    title: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    bodyMarkdown: {
      type: String,
      cast: false,
      required: true,
      minlength: 1,
      maxlength: 10000,
      validate: (value: string) => value.trim().length > 0,
    },
  },
  { _id: false, strict: 'throw' },
);
const reviseSchema = new Schema(
  {
    summary: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    keyPoints: {
      type: [
        {
          type: String,
          cast: false,
          required: true,
          trim: true,
          minlength: 1,
          maxlength: 500,
        },
      ],
      default: undefined,
      set: (value: unknown) => {
        if (value !== undefined && !Array.isArray(value))
          throw new mongoose.Error.CastError('Array', value, 'keyPoints');
        return value;
      },
      validate: (value: string[] | undefined) =>
        value === undefined || (Array.isArray(value) && value.length <= 10),
    },
    memoryTrick: {
      type: String,
      cast: false,
      trim: true,
      minlength: 1,
      maxlength: 2000,
      validate: (value: string | null | undefined) =>
        value === undefined || (typeof value === 'string' && value.length > 0),
    },
    importantCodeMarkdown: {
      type: String,
      cast: false,
      minlength: 1,
      maxlength: 10000,
      validate: (value: string | null | undefined) =>
        value === undefined ||
        (typeof value === 'string' && value.trim().length > 0),
    },
  },
  { _id: false, strict: 'throw' },
);
const sourceSchema = new Schema(
  {
    label: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    url: {
      type: String,
      cast: false,
      required: true,
      maxlength: 2048,
      validate: (value: string) => {
        try {
          const url = new URL(value);
          return (
            /^https:\/\//i.test(value) &&
            !/[\s\\]/.test(value) &&
            ![...value].some(
              (character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
            ) &&
            url.protocol === 'https:' &&
            !!url.hostname &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      },
    },
    sourceType: {
      type: String,
      cast: false,
      required: true,
      enum: ['OFFICIAL_OR_TRUSTED'],
    },
    isOfficial: { type: Boolean, cast: false, required: true },
  },
  { _id: false, strict: 'throw' },
);
export const conceptSchema = new Schema(
  {
    technologyId: {
      type: Schema.Types.ObjectId,
      ref: 'Technology',
      required: true,
    },
    learningPathId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningPath',
      required: true,
    },
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      maxlength: 100,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/,
    },
    difficulty: {
      type: String,
      required: true,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'],
    },
    contentFormat: {
      type: String,
      required: true,
      enum: ['MARKDOWN'],
      default: 'MARKDOWN',
    },
    read: { type: readSchema, required: true },
    source: {
      type: sourceSchema,
      required: true,
      set: (value: unknown) => {
        if (
          value !== undefined &&
          (value === null || typeof value !== 'object' || Array.isArray(value))
        )
          throw new mongoose.Error.CastError('Embedded', value, 'source');
        return value;
      },
    },
    revise: {
      type: reviseSchema,
      default: undefined,
      set: (value: unknown) => {
        if (
          value !== undefined &&
          (value === null || typeof value !== 'object' || Array.isArray(value))
        )
          throw new mongoose.Error.CastError('Embedded', value, 'revise');
        return value;
      },
    },
    examples: {
      type: [exampleSchema],
      default: undefined,
      set: (value: unknown) => {
        if (value !== undefined && !Array.isArray(value))
          throw new mongoose.Error.CastError('Array', value, 'examples');
        return value;
      },
      validate: (
        value: { title: string; bodyMarkdown: string }[] | null | undefined,
      ) =>
        value === undefined ||
        (Array.isArray(value) &&
          value.length <= 10 &&
          value.every((entry) => entry != null) &&
          value.reduce(
            (total, entry) => total + (entry.bodyMarkdown?.length ?? 0),
            0,
          ) <= 50000),
    },
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'AI_GENERATED',
        'IN_REVIEW',
        'CHANGES_REQUIRED',
        'APPROVED',
        'PUBLISHED',
        'ARCHIVED',
      ],
      default: 'DRAFT',
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },
    schemaVersion: { type: Number, required: true, enum: [1], default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    collection: 'concepts',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
conceptSchema.index({ topicId: 1, slug: 1 }, { unique: true });
conceptSchema.index({ topicId: 1, status: 1, order: 1, slug: 1 });
export type ConceptRecord = InferSchemaType<typeof conceptSchema>;
export const Concept = mongoose.model('Concept', conceptSchema);
