import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';

const ref = z.instanceof(Types.ObjectId);
const hash = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const version = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const completionRequestRecord = z.strictObject({
  _id: ref,
  userId: ref,
  conceptId: ref,
  policyId: ref,
  policyVersion: version,
  conceptRevision: hash,
  viewRevision: hash,
  requestKeyHash: hash,
  requestFingerprint: hash,
  summaryId: ref,
  decisionVersion: version,
  committedAt: z.date(),
  schemaVersion: z.literal(1),
});
export type CompletionRequest = z.output<typeof completionRequestRecord>;
export const completionRequestIndex = {
  collection: 'completionRequests',
  name: 'uq_completion_request_owner_key',
  key: { userId: 1, requestKeyHash: 1 },
  unique: true,
} as const;
const schema = new Schema<CompletionRequest>(
  {
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
      cast: false,
      immutable: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      cast: false,
      immutable: true,
    },
    conceptId: {
      type: Schema.Types.ObjectId,
      required: true,
      cast: false,
      immutable: true,
    },
    policyId: {
      type: Schema.Types.ObjectId,
      required: true,
      cast: false,
      immutable: true,
    },
    policyVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
    conceptRevision: {
      type: String,
      required: true,
      cast: false,
      immutable: true,
      select: false,
    },
    viewRevision: {
      type: String,
      required: true,
      cast: false,
      immutable: true,
    },
    requestKeyHash: {
      type: String,
      required: true,
      cast: false,
      immutable: true,
      select: false,
    },
    requestFingerprint: {
      type: String,
      required: true,
      cast: false,
      immutable: true,
      select: false,
    },
    summaryId: {
      type: Schema.Types.ObjectId,
      required: true,
      cast: false,
      immutable: true,
    },
    decisionVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
    committedAt: { type: Date, required: true, cast: false, immutable: true },
    schemaVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
  },
  {
    collection: completionRequestIndex.collection,
    strict: 'throw',
    versionKey: false,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
schema.index(completionRequestIndex.key, {
  name: completionRequestIndex.name,
  unique: true,
});
schema.pre('validate', function () {
  completionRequestRecord.parse(
    this.toObject({ getters: false, virtuals: false, transform: false }),
  );
});
function denied(): never {
  throw new Error('Completion requests are append-only');
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
const Model = mongoose.model<CompletionRequest>('CompletionRequest', schema);
export class CompletionRequestReceipt extends Model {
  constructor(input: CompletionRequest) {
    super(completionRequestRecord.parse(input));
  }
}
