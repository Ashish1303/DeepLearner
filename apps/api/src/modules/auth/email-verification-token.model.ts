import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

function redact(_doc: unknown, value: Record<string, unknown>) {
  delete value.tokenHash;
  return value;
}

export const emailVerificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: {
      type: String,
      required: true,
      match: /^[a-f0-9]{64}$/,
      select: false,
    },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now, required: true },
    usedAt: { type: Date, default: null },
  },
  {
    collection: 'emailVerificationTokens',
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    toJSON: { transform: redact },
    toObject: { transform: redact },
  },
);

emailVerificationTokenSchema.index({ tokenHash: 1 }, { unique: true });
emailVerificationTokenSchema.index({ userId: 1 });
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailVerificationTokenRecord = InferSchemaType<
  typeof emailVerificationTokenSchema
>;
export const EmailVerificationToken = mongoose.model(
  'EmailVerificationToken',
  emailVerificationTokenSchema,
);
