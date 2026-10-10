import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

export const learningPathSchema = new Schema(
  {
    technologyId: {
      type: Schema.Types.ObjectId,
      ref: 'Technology',
      required: true,
    },
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
    description: { type: String, maxlength: 2000 },
    targetLevel: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
      default: null,
    },
    completionScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 70,
      validate: Number.isInteger,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      required: true,
      default: 'DRAFT',
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    collection: 'learningPaths',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
learningPathSchema.index({ technologyId: 1, slug: 1 }, { unique: true });
learningPathSchema.index({ technologyId: 1, status: 1, order: 1 });
export type LearningPathRecord = InferSchemaType<typeof learningPathSchema>;
export const LearningPath = mongoose.model('LearningPath', learningPathSchema);
