import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

const deviceSchema = new Schema(
  {
    userAgent: { type: String, maxlength: 512 },
    deviceLabel: { type: String, trim: true, maxlength: 200 },
  },
  { _id: false, strict: 'throw' },
);

function redact(_doc: unknown, value: Record<string, unknown>) {
  delete value.refreshTokenHash;
  delete value.ipHash;
  return value;
}

export const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
    },
    deviceInfo: { type: deviceSchema, default: undefined },
    ipHash: { type: String, match: /^[a-f0-9]{64}$/, select: false },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    lastUsedAt: { type: Date, default: Date.now, required: true },
    revokedAt: { type: Date, default: null },
    revocationReason: { type: String, trim: true, maxlength: 500 },
  },
  {
    collection: 'sessions',
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    toJSON: { transform: redact },
    toObject: { transform: redact },
  },
);

sessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1, revokedAt: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionRecord = InferSchemaType<typeof sessionSchema>;
export const Session = mongoose.model('Session', sessionSchema);
