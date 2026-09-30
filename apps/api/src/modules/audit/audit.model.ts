import { Schema, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';

export const auditSchema = new Schema(
  {
    category: { type: String, enum: ['AUTH'], required: true, immutable: true },
    action: {
      type: String,
      enum: [
        'AUTH_REGISTERED',
        'AUTH_EMAIL_VERIFIED',
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILED',
        'AUTH_REFRESH_SUCCESS',
        'AUTH_REFRESH_REUSE_DETECTED',
      ],
      required: true,
      immutable: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: function (this: { action: string }): boolean {
        return this.action !== 'AUTH_LOGIN_FAILED';
      },
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
      required: function (this: { action: string }): boolean {
        return this.action !== 'AUTH_LOGIN_FAILED';
      },
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
        {
          source: {
            type: String,
            enum: ['EMAIL_PASSWORD', 'REFRESH_TOKEN'],
            required: true,
          },
          sessionId: { type: Schema.Types.ObjectId },
          failureReason: {
            type: String,
            enum: [
              'INVALID_CREDENTIALS',
              'EMAIL_NOT_VERIFIED',
              'ACCOUNT_DISABLED',
              'ACCOUNT_SUSPENDED',
              'TOKEN_REUSE',
            ],
          },
          reactivatedFromExpiredSuspension: { type: Boolean },
        },
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
auditSchema.pre('validate', function () {
  const action = this.action;
  const meta = this.metadata;
  const success = ['AUTH_LOGIN_SUCCESS', 'AUTH_REFRESH_SUCCESS'].includes(
    action,
  );
  const refresh = action?.startsWith('AUTH_REFRESH_') ?? false;
  if (
    Boolean(this.actorId) !== Boolean(this.resourceId) ||
    (this.actorId && String(this.actorId) !== String(this.resourceId))
  )
    this.invalidate('actorId', 'Matching subject IDs required');
  if (!meta) return;
  if (meta.source !== (refresh ? 'REFRESH_TOKEN' : 'EMAIL_PASSWORD'))
    this.invalidate('metadata.source', 'Invalid source');
  if ((success || refresh) !== Boolean(meta.sessionId))
    this.invalidate('metadata.sessionId', 'Session metadata must match action');
  if (action === 'AUTH_LOGIN_FAILED') {
    if (!meta.failureReason || meta.failureReason === 'TOKEN_REUSE')
      this.invalidate(
        'metadata.failureReason',
        'Login failure reason required',
      );
    if (!this.actorId && meta.failureReason !== 'INVALID_CREDENTIALS')
      this.invalidate('actorId', 'Known subject required');
  } else if (action === 'AUTH_REFRESH_REUSE_DETECTED') {
    if (meta.failureReason !== 'TOKEN_REUSE')
      this.invalidate('metadata.failureReason', 'Reuse reason required');
  } else if (meta.failureReason !== undefined)
    this.invalidate('metadata.failureReason', 'Failure reason prohibited');
  if (!success && meta.reactivatedFromExpiredSuspension !== undefined)
    this.invalidate(
      'metadata.reactivatedFromExpiredSuspension',
      'Success only',
    );
});

auditSchema.index({ actorId: 1, createdAt: -1 });
auditSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
export type AuditRecord = InferSchemaType<typeof auditSchema>;
export const Audit = mongoose.model('Audit', auditSchema);
