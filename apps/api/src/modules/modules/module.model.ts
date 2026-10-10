import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

export const moduleSchema = new Schema(
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
  },
  {
    collection: 'modules',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
moduleSchema.index({ learningPathId: 1, slug: 1 }, { unique: true });
moduleSchema.index({ learningPathId: 1, status: 1, order: 1 });
export type ModuleRecord = InferSchemaType<typeof moduleSchema>;
export const Module = mongoose.model('Module', moduleSchema);
