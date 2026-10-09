import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

export const technologySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      maxlength: 100,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/,
    },
    description: { type: String, maxlength: 2000 },
    iconAssetId: { type: Schema.Types.ObjectId, default: null },
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
    collection: 'technologies',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
technologySchema.index({ slug: 1 }, { unique: true });
technologySchema.index({ status: 1, order: 1 });
export type TechnologyRecord = InferSchemaType<typeof technologySchema>;
export const Technology = mongoose.model('Technology', technologySchema);
