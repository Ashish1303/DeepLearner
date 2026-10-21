import { createHash } from 'node:crypto';
import { types } from 'node:util';
import { Schema, Types } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';

export const gradingId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
export const gradingDigest = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
export const positiveVersion = z
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const gradingReference = z.instanceof(Types.ObjectId);
export const correlationId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}(?![\s\S])/);
export const sha256 = (value: unknown[]) =>
  createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');

// Structural text validation grants no approval and performs no grading.
export const rubricText = z
  .string()
  .min(1)
  .max(10_000)
  .refine((value) => {
    if (value.length > 10_000 || !/\S/u.test(value)) return false;
    for (let i = 0; i < value.length; i++) {
      const unit = value.charCodeAt(i);
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const next = value.charCodeAt(++i);
        if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    }
    return true;
  });

// Unknown internal command data must not execute accessors, proxies or coercion.
export function commandData(input: unknown): unknown {
  let budget = 200;
  const ancestors = new Set<object>();
  function copy(value: unknown, depth: number): unknown {
    if (--budget < 0 || depth > 4) throw new Error('Invalid command');
    if (
      value === null ||
      value === undefined ||
      ['string', 'number', 'boolean'].includes(typeof value)
    )
      return value;
    if (
      typeof value !== 'object' ||
      types.isProxy(value) ||
      Array.isArray(value) ||
      ancestors.has(value)
    )
      throw new Error('Invalid command');
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
      throw new Error('Invalid command');
    const keys = Reflect.ownKeys(value);
    if (keys.length > 32 || keys.some((k) => typeof k !== 'string'))
      throw new Error('Invalid command');
    ancestors.add(value);
    try {
      const result: Record<string, unknown> = Object.create(null);
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !('value' in descriptor))
          throw new Error('Invalid command');
        result[key as string] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }
  return copy(input, 0);
}

const definitionShape = {
  _id: gradingReference,
  rubricId: gradingReference,
  version: positiveVersion,
  questionId: gradingReference,
  conceptId: gradingReference,
  type: z.literal('OUTPUT'),
  questionRevision: gradingDigest,
  contentFingerprint: gradingDigest,
  answerForm: z.literal('TEXT'),
  comparison: z.literal('EXACT_TEXT'),
  normalization: z.literal('NONE'),
  expectedAnswer: rubricText,
  definitionFingerprint: gradingDigest,
  authorId: gradingReference,
  createdAt: z.date(),
  schemaVersion: z.literal(1),
};
const definitionBase = z.strictObject(definitionShape);
export const rubricDefinition = definitionBase.refine(
  (row) =>
    definitionBase.safeParse(row).success &&
    row.definitionFingerprint === definitionFingerprint(row),
);
export type RubricDefinition = z.output<typeof rubricDefinition>;
export function definitionFingerprint(
  row: z.output<z.ZodObject<typeof definitionShape>>,
) {
  return sha256([
    'F038-rubric-v1',
    row.rubricId.toHexString(),
    row.version,
    row.questionId.toHexString(),
    row.conceptId.toHexString(),
    row.type,
    row.questionRevision,
    row.contentFingerprint,
    row.answerForm,
    row.comparison,
    row.normalization,
    row.expectedAnswer,
    row.authorId.toHexString(),
  ]);
}
export const rubricAuthority = z
  .strictObject({
    _id: gradingReference,
    rubricId: gradingReference,
    version: positiveVersion,
    definitionId: gradingReference,
    definitionFingerprint: gradingDigest,
    authorId: gradingReference,
    reviewerId: gradingReference,
    approvedAt: z.date(),
    approvalAuditId: gradingReference,
    state: z.enum(['APPROVED', 'REVOKED']),
    decisionFence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    revokedBy: gradingReference.nullable(),
    revokedAt: z.date().nullable(),
    revocationAuditId: gradingReference.nullable(),
    schemaVersion: z.literal(1),
  })
  .refine(
    (r) =>
      !r.authorId.equals(r.reviewerId) &&
      (r.state === 'APPROVED'
        ? r.revokedBy === null &&
          r.revokedAt === null &&
          r.revocationAuditId === null
        : r.revokedBy !== null &&
          r.revokedAt !== null &&
          r.revocationAuditId !== null &&
          r.revokedAt >= r.approvedAt),
  );
export type RubricAuthority = z.output<typeof rubricAuthority>;
export const rubricIndexes = [
  {
    collection: 'practiceRubricVersions',
    name: 'uq_practice_rubric_version',
    key: { rubricId: 1, version: 1 },
    unique: true,
  },
  {
    collection: 'practiceRubricAuthorities',
    name: 'uq_practice_rubric_authority',
    key: { rubricId: 1, version: 1 },
    unique: true,
  },
] as const;
export const gradingSchemaOptions = {
  strict: 'throw',
  versionKey: false,
  autoCreate: false,
  autoIndex: false,
  bufferCommands: false,
} as const;
const ref = {
  type: Schema.Types.ObjectId,
  required: true,
  cast: false,
  immutable: true,
};
const text = { type: String, required: true, cast: false, immutable: true };
const date = { type: Date, required: true, cast: false, immutable: true };
const definitionSchema = new Schema<RubricDefinition>(
  {
    _id: ref,
    rubricId: ref,
    version: { type: Number, required: true, cast: false, immutable: true },
    questionId: ref,
    conceptId: ref,
    type: text,
    questionRevision: { ...text, select: false },
    contentFingerprint: { ...text, select: false },
    answerForm: text,
    comparison: text,
    normalization: text,
    expectedAnswer: { ...text, select: false },
    definitionFingerprint: { ...text, select: false },
    authorId: ref,
    createdAt: date,
    schemaVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
  },
  { ...gradingSchemaOptions, collection: 'practiceRubricVersions' },
);
definitionSchema.index(rubricIndexes[0].key, {
  name: rubricIndexes[0].name,
  unique: true,
});
const authoritySchema = new Schema<RubricAuthority>(
  {
    _id: ref,
    rubricId: ref,
    version: { type: Number, required: true, cast: false, immutable: true },
    definitionId: ref,
    definitionFingerprint: { ...text, select: false },
    authorId: ref,
    reviewerId: ref,
    approvedAt: date,
    approvalAuditId: ref,
    state: { type: String, required: true, cast: false },
    decisionFence: { type: Number, required: true, cast: false },
    revokedBy: { type: Schema.Types.ObjectId, cast: false, default: null },
    revokedAt: { type: Date, cast: false, default: null },
    revocationAuditId: {
      type: Schema.Types.ObjectId,
      cast: false,
      default: null,
    },
    schemaVersion: {
      type: Number,
      required: true,
      cast: false,
      immutable: true,
    },
  },
  { ...gradingSchemaOptions, collection: 'practiceRubricAuthorities' },
);
authoritySchema.index(rubricIndexes[1].key, {
  name: rubricIndexes[1].name,
  unique: true,
});
definitionSchema.pre('validate', function () {
  rubricDefinition.parse(
    this.toObject({ transform: false, virtuals: false, getters: false }),
  );
});
authoritySchema.pre('validate', function () {
  rubricAuthority.parse(
    this.toObject({ transform: false, virtuals: false, getters: false }),
  );
});
function denied(): never {
  throw new Error('Use the owned rubric repository');
}
function guardWrites<T extends object>(schema: Schema<T>) {
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
}
guardWrites(definitionSchema);
guardWrites(authoritySchema);
const Version = mongoose.model<RubricDefinition>(
  'PracticeRubricVersion',
  definitionSchema,
);
const Authority = mongoose.model<RubricAuthority>(
  'PracticeRubricAuthority',
  authoritySchema,
);
export class PracticeRubricVersion extends Version {
  constructor(row: RubricDefinition) {
    super(rubricDefinition.parse(row));
  }
}
export class PracticeRubricAuthority extends Authority {
  constructor(row: RubricAuthority) {
    super(rubricAuthority.parse(row));
  }
}
