import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

function redact(_doc: unknown, value: Record<string, unknown>) {
  delete value.tokenHash;
  return value;
}

export const passwordResetTokenSchema = new Schema(
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
    collection: 'passwordResetTokens',
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    toJSON: { transform: redact },
    toObject: { transform: redact },
  },
);

passwordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
passwordResetTokenSchema.index({ userId: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenRecord = InferSchemaType<
  typeof passwordResetTokenSchema
>;
export const PasswordResetToken = mongoose.model(
  'PasswordResetToken',
  passwordResetTokenSchema,
);
