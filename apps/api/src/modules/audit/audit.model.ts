import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

export const auditSchema = new Schema(
  {
    category: { type: String, enum: ['AUTH'], required: true, immutable: true },
    action: {
      type: String,
      enum: ['AUTH_REGISTERED', 'AUTH_EMAIL_VERIFIED'],
      required: true,
      immutable: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    resourceType: {
      type: String,
      enum: ['USER'],
      required: true,
      immutable: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    requestId: {
      type: String,
      required: true,
      match: /^[a-zA-Z0-9_-]{1,128}$/,
      immutable: true,
    },
    metadata: {
      type: new Schema(
        { source: { type: String, enum: ['EMAIL_PASSWORD'], required: true } },
        { _id: false, strict: 'throw' },
      ),
      required: true,
      immutable: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true,
    },
  },
  {
    collection: 'auditLogs',
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    versionKey: false,
  },
);
auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
export type AuditRecord = InferSchemaType<typeof auditSchema>;
export const Audit = mongoose.model('Audit', auditSchema);
