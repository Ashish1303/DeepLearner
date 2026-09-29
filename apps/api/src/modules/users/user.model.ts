import { Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';

const providerSchema = new Schema(
  {
    provider: { type: String, enum: ['GOOGLE'], required: true },
    providerUserId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
  },
  { _id: false, strict: 'throw' },
);

const profileSchema = new Schema(
  {
    experienceLevel: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    },
    learningGoals: {
      type: [
        {
          type: String,
          required: true,
          enum: [
            'LEARN_FROM_SCRATCH',
            'INTERVIEW_PREPARATION',
            'QUICK_REVISION',
            'MASTER_TECHNOLOGY',
            'STRENGTHEN_WEAK_AREAS',
          ],
        },
      ],
      validate: (values: string[]) => new Set(values).size === values.length,
    },
    interestedTechnologyIds: {
      type: [{ type: Schema.Types.ObjectId, required: true }],
      validate: (values: import('mongoose').Types.ObjectId[]) =>
        values.length <= 50 &&
        new Set(values.map(String)).size === values.length,
    },
    preferredDifficulty: {
      type: String,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'],
    },
    dailyStudyGoalMinutes: {
      type: Number,
      min: 5,
      max: 240,
      validate: Number.isInteger,
    },
  },
  { _id: false, strict: 'throw' },
);

function redact(_doc: unknown, value: Record<string, unknown>) {
  delete value.passwordHash;
  delete value.authProviders;
  return value;
}

export const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      validate: (value: string) => z.email().safeParse(value).success,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 80 },
    lastName: { type: String, required: true, trim: true, maxlength: 80 },
    role: {
      type: String,
      enum: ['STUDENT', 'ADMIN'],
      default: 'STUDENT',
      required: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'PREMIUM'],
      default: 'FREE',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'SUSPENDED'],
      default: 'PENDING_VERIFICATION',
      required: true,
    },
    passwordHash: {
      type: String,
      default: null,
      select: false,
      validate: (value: string | null) =>
        value === null ||
        /^\$argon2id\$v=19\$m=[1-9]\d*,(?:t=[1-9]\d*,p=[1-9]\d*|p=[1-9]\d*,t=[1-9]\d*)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.test(
          value,
        ),
    },
    authProviders: {
      type: [providerSchema],
      select: false,
      validate: (values: { provider: string; providerUserId: string }[]) =>
        new Set(
          values.map((value) => `${value.provider}:${value.providerUserId}`),
        ).size === values.length,
    },
    emailVerifiedAt: { type: Date, default: null },
    suspendedUntil: { type: Date, default: null },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
    profile: { type: profileSchema, default: undefined },
    lastLoginAt: { type: Date, default: null },
  },
  {
    collection: 'users',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    toJSON: { transform: redact },
    toObject: { transform: redact },
  },
);

userSchema.virtual('displayName').get(function (
  this: HydratedDocument<UserRecord>,
) {
  return `${this.firstName} ${this.lastName}`;
});

// Credential changes require both capabilities loaded; never infer absence from projection.
userSchema.pre('validate', function (this: HydratedDocument<UserRecord>) {
  if (
    !this.isNew &&
    !this.isModified('passwordHash') &&
    !this.isModified('authProviders')
  )
    return;
  if (
    !this.isNew &&
    (!this.isSelected('passwordHash') || !this.isSelected('authProviders'))
  ) {
    this.invalidate(
      'authProviders',
      'Load both authentication capabilities before changing credentials',
    );
    return;
  }
  if (!this.passwordHash && !this.authProviders?.length) {
    this.invalidate('passwordHash', 'An authentication capability is required');
  }
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1, createdAt: -1 });
userSchema.index({ plan: 1, createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index(
  { 'authProviders.provider': 1, 'authProviders.providerUserId': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'authProviders.providerUserId': { $type: 'string' },
    },
  },
);

export type UserRecord = InferSchemaType<typeof userSchema>;
export type StudentProfile = InferSchemaType<typeof profileSchema>;
export const User = mongoose.model('User', userSchema);
