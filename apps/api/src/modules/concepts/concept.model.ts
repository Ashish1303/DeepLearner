import { Schema, Types, type InferSchemaType } from 'mongoose';
import { mongoose } from '../../config/database.js';
import { z } from 'zod';
import { createHash } from 'node:crypto';

const policyId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const policyDigest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const policyVersion = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const policyBase = z.strictObject({
  policyId,
  version: policyVersion,
  conceptId: policyId,
  conceptRevision: policyDigest,
  sourceEpoch: policyDigest,
  requiredSections: z
    .array(z.enum(['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE', 'REVISE']))
    .min(4)
    .max(5),
  minimumScore: z.literal(70),
  questionId: policyId,
  questionRevision: policyDigest,
  contentFingerprint: policyDigest,
  rubricId: policyId,
  rubricVersion: policyVersion,
  rubricDefinitionFingerprint: policyDigest,
  checkpointDefinitionId: policyId,
  checkpointFingerprint: policyDigest,
  visualizationRevision: policyDigest,
  authoredBy: policyId,
  authoredAt: z.date(),
  fingerprint: policyDigest,
  state: z.enum(['DRAFT', 'APPROVED', 'REVOKED']),
  approvedBy: policyId.nullable(),
  approvedAt: z.date().nullable(),
  approvedFingerprint: policyDigest.nullable(),
  revokedBy: policyId.nullable(),
  revokedAt: z.date().nullable(),
});
export const conceptCompletionPolicy = policyBase.refine((p) => {
  const sections = p.requiredSections;
  const approved =
    p.approvedBy !== null &&
    p.approvedBy !== p.authoredBy &&
    p.approvedAt !== null &&
    p.approvedAt >= p.authoredAt &&
    p.approvedFingerprint === p.fingerprint;
  const draft =
    p.approvedBy === null &&
    p.approvedAt === null &&
    p.approvedFingerprint === null;
  return (
    new Set(sections).size === sections.length &&
    ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'].every((s) =>
      sections.includes(s as (typeof sections)[number]),
    ) &&
    p.fingerprint === completionPolicyFingerprint(p) &&
    (p.state === 'DRAFT'
      ? draft && p.revokedBy === null && p.revokedAt === null
      : p.state === 'APPROVED'
        ? approved && p.revokedBy === null && p.revokedAt === null
        : (draft || approved) &&
          p.revokedBy !== null &&
          p.revokedAt !== null &&
          p.revokedAt >= (p.approvedAt ?? p.authoredAt))
  );
});
export type ConceptCompletionPolicy = z.output<typeof conceptCompletionPolicy>;
export function completionPolicyFingerprint(
  p:
    | Omit<z.output<typeof policyBase>, 'fingerprint'>
    | z.output<typeof policyBase>,
) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'F038-concept-policy-v1',
        p.policyId,
        p.version,
        p.conceptId,
        p.conceptRevision,
        p.sourceEpoch,
        p.requiredSections,
        p.minimumScore,
        p.questionId,
        p.questionRevision,
        p.contentFingerprint,
        p.rubricId,
        p.rubricVersion,
        p.rubricDefinitionFingerprint,
        p.checkpointDefinitionId,
        p.checkpointFingerprint,
        p.visualizationRevision,
        p.authoredBy,
      ]),
    )
    .digest('hex');
}
export const conceptCompletionRules = z
  .strictObject({
    schemaVersion: z.literal(1),
    decisionFence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    activeVersion: policyVersion.nullable(),
    versions: z.array(conceptCompletionPolicy).max(10),
  })
  .refine(
    (r) =>
      new Set(r.versions.map((p) => p.version)).size === r.versions.length &&
      (r.activeVersion === null ||
        r.versions.some(
          (p) => p.version === r.activeVersion && p.state === 'APPROVED',
        )),
  );
export type ConceptCompletionRules = z.output<typeof conceptCompletionRules>;
const policyReferences = [
  'conceptId',
  'questionId',
  'rubricId',
  'checkpointDefinitionId',
  'authoredBy',
  'approvedBy',
  'revokedBy',
] as const;
/** Persist canonical references as BSON ObjectIds; use lowercase IDs internally. */
export function completionRulesToStorage(value: ConceptCompletionRules) {
  const r = conceptCompletionRules.parse(value);
  return {
    ...r,
    versions: r.versions.map((p) => {
      const result: Record<string, unknown> = { ...p };
      for (const field of policyReferences)
        result[field] = p[field] === null ? null : new Types.ObjectId(p[field]);
      return result;
    }),
  };
}
export function completionRulesFromStorage(
  value: unknown,
): ConceptCompletionRules {
  if (
    !value ||
    typeof value !== 'object' ||
    !('versions' in value) ||
    !Array.isArray(value.versions)
  )
    throw new Error('Invalid stored completion policy');
  return conceptCompletionRules.parse({
    ...value,
    versions: value.versions.map((p: Record<string, unknown>) => {
      const result = { ...p };
      for (const field of policyReferences) {
        const ref = p[field];
        if (ref === null && (field === 'approvedBy' || field === 'revokedBy'))
          result[field] = null;
        else if (ref instanceof Types.ObjectId)
          result[field] = ref.toHexString();
        else throw new Error('Invalid stored completion reference');
      }
      return result;
    }),
  });
}
const readSchema = new Schema(
  {
    summary: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    bodyMarkdown: {
      type: String,
      required: true,
      maxlength: 50000,
      validate: (value: string) => value.trim().length > 0,
    },
  },
  { _id: false, strict: 'throw' },
);
const exampleSchema = new Schema(
  {
    title: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    bodyMarkdown: {
      type: String,
      cast: false,
      required: true,
      minlength: 1,
      maxlength: 10000,
      validate: (value: string) => value.trim().length > 0,
    },
  },
  { _id: false, strict: 'throw' },
);
const reviseSchema = new Schema(
  {
    summary: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 2000,
    },
    keyPoints: {
      type: [
        {
          type: String,
          cast: false,
          required: true,
          trim: true,
          minlength: 1,
          maxlength: 500,
        },
      ],
      default: undefined,
      set: (value: unknown) => {
        if (value !== undefined && !Array.isArray(value))
          throw new mongoose.Error.CastError('Array', value, 'keyPoints');
        return value;
      },
      validate: (value: string[] | undefined) =>
        value === undefined || (Array.isArray(value) && value.length <= 10),
    },
    memoryTrick: {
      type: String,
      cast: false,
      trim: true,
      minlength: 1,
      maxlength: 2000,
      validate: (value: string | null | undefined) =>
        value === undefined || (typeof value === 'string' && value.length > 0),
    },
    importantCodeMarkdown: {
      type: String,
      cast: false,
      minlength: 1,
      maxlength: 10000,
      validate: (value: string | null | undefined) =>
        value === undefined ||
        (typeof value === 'string' && value.trim().length > 0),
    },
  },
  { _id: false, strict: 'throw' },
);
const sourceSchema = new Schema(
  {
    label: {
      type: String,
      cast: false,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    url: {
      type: String,
      cast: false,
      required: true,
      maxlength: 2048,
      validate: (value: string) => {
        try {
          const url = new URL(value);
          return (
            /^https:\/\//i.test(value) &&
            !/[\s\\]/.test(value) &&
            ![...value].some(
              (character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
            ) &&
            url.protocol === 'https:' &&
            !!url.hostname &&
            !url.username &&
            !url.password
          );
        } catch {
          return false;
        }
      },
    },
    sourceType: {
      type: String,
      cast: false,
      required: true,
      enum: ['OFFICIAL_OR_TRUSTED'],
    },
    isOfficial: { type: Boolean, cast: false, required: true },
  },
  { _id: false, strict: 'throw' },
);
export const conceptSchema = new Schema(
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
    moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true },
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
    difficulty: {
      type: String,
      required: true,
      enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'INTERVIEW_READY'],
    },
    contentFormat: {
      type: String,
      required: true,
      enum: ['MARKDOWN'],
      default: 'MARKDOWN',
    },
    read: { type: readSchema, required: true },
    source: {
      type: sourceSchema,
      required: true,
      set: (value: unknown) => {
        if (
          value !== undefined &&
          (value === null || typeof value !== 'object' || Array.isArray(value))
        )
          throw new mongoose.Error.CastError('Embedded', value, 'source');
        return value;
      },
    },
    revise: {
      type: reviseSchema,
      default: undefined,
      set: (value: unknown) => {
        if (
          value !== undefined &&
          (value === null || typeof value !== 'object' || Array.isArray(value))
        )
          throw new mongoose.Error.CastError('Embedded', value, 'revise');
        return value;
      },
    },
    examples: {
      type: [exampleSchema],
      default: undefined,
      set: (value: unknown) => {
        if (value !== undefined && !Array.isArray(value))
          throw new mongoose.Error.CastError('Array', value, 'examples');
        return value;
      },
      validate: (
        value: { title: string; bodyMarkdown: string }[] | null | undefined,
      ) =>
        value === undefined ||
        (Array.isArray(value) &&
          value.length <= 10 &&
          value.every((entry) => entry != null) &&
          value.reduce(
            (total, entry) => total + (entry.bodyMarkdown?.length ?? 0),
            0,
          ) <= 50000),
    },
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'AI_GENERATED',
        'IN_REVIEW',
        'CHANGES_REQUIRED',
        'APPROVED',
        'PUBLISHED',
        'ARCHIVED',
      ],
      default: 'DRAFT',
    },
    order: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },
    completionRules: {
      type: Schema.Types.Mixed,
      default: undefined,
      select: false,
      validate: (value: unknown) => {
        if (value === undefined) return true;
        try {
          completionRulesFromStorage(value);
          return true;
        } catch {
          return false;
        }
      },
    },
    schemaVersion: { type: Number, required: true, enum: [1], default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    collection: 'concepts',
    timestamps: true,
    strict: 'throw',
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
  },
);
conceptSchema.index({ topicId: 1, slug: 1 }, { unique: true });
conceptSchema.index({ topicId: 1, status: 1, order: 1, slug: 1 });
export type ConceptRecord = InferSchemaType<typeof conceptSchema>;
export const Concept = mongoose.model('Concept', conceptSchema);
