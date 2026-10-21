import { Schema } from 'mongoose';
import { z } from 'zod';
import { mongoose } from '../../config/database.js';
import {
  evidenceCorrelation,
  evidenceDigest,
} from '../progress/section-evidence-revision.js';
import {
  evidenceDate,
  evidenceReference,
  evidenceSchemaOptions,
  guardEvidenceWrites,
} from '../progress/section-evidence-challenge.model.js';
import { verifyVisualizationCheckpoint } from './checkpoint-verification.js';
import {
  checkpointBinding,
  checkpointPolicy,
  checkpointToken,
  definitionFingerprint,
} from './visualization-checkpoint-revision.js';

export const checkpointText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((v) => {
      if (!/\S/u.test(v)) return false;
      for (let i = 0; i < v.length; i++) {
        const u = v.charCodeAt(i);
        if (u >= 0xd800 && u <= 0xdbff) {
          const n = v.charCodeAt(++i);
          if (!(n >= 0xdc00 && n <= 0xdfff)) return false;
        } else if (u >= 0xdc00 && u <= 0xdfff) return false;
      }
      return true;
    });
export const checkpointChoices = z
  .array(z.strictObject({ id: z.string().max(64), label: z.string().max(240) }))
  .min(2)
  .max(8);
const shape = {
  _id: evidenceReference,
  schemaVersion: z.literal(1),
  conceptId: evidenceReference,
  visualizationId: evidenceReference,
  conceptRevision: evidenceDigest,
  visualizationRevision: evidenceDigest,
  checkpointId: z.string().regex(checkpointToken),
  checkpointVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  policyId: z.literal(checkpointPolicy.policyId),
  policyVersion: z.literal(1),
  verifierVersion: z.literal(1),
  responseType: z.literal('SINGLE_CHOICE'),
  choices: checkpointChoices,
  expectedChoiceId: z.string().max(64),
  prompt: checkpointText(2000),
  textAlternative: checkpointText(4000),
  definitionFingerprint: evidenceDigest,
  authoredBy: evidenceReference,
  authoredAt: evidenceDate,
  authorRequestId: evidenceCorrelation,
  state: z.enum(['DRAFT', 'APPROVED', 'REVOKED']),
  decisionFence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  approvedBy: evidenceReference.nullable(),
  approvedAt: evidenceDate.nullable(),
  approvedFingerprint: evidenceDigest.nullable(),
  revokedBy: evidenceReference.nullable(),
  revokedAt: evidenceDate.nullable(),
};
type DefinitionShape = z.output<z.ZodObject<typeof shape>>;
export type CheckpointDefinition = DefinitionShape;
export function validCheckpointDefinition(d: DefinitionShape) {
  const binding = checkpointBinding(d);
  const evaluated = verifyVisualizationCheckpoint({
    schemaVersion: 1,
    expected: binding,
    definition: {
      ...binding,
      responseType: d.responseType,
      choices: d.choices,
      expectedChoiceId: d.expectedChoiceId,
    },
    response: {
      ...binding,
      responseType: d.responseType,
      selectedChoiceId: d.expectedChoiceId,
    },
  });
  const approval =
    d.approvedBy !== null &&
    d.approvedAt !== null &&
    d.approvedFingerprint === d.definitionFingerprint &&
    !d.approvedBy.equals(d.authoredBy) &&
    d.approvedAt >= d.authoredAt;
  const noApproval =
    d.approvedBy === null &&
    d.approvedAt === null &&
    d.approvedFingerprint === null;
  const revoked =
    d.revokedBy !== null &&
    d.revokedAt !== null &&
    d.revokedAt >= d.authoredAt &&
    (!d.approvedAt || d.revokedAt >= d.approvedAt);
  return (
    evaluated.status === 'EVALUATED' &&
    evaluated.outcome === 'CORRECT' &&
    d.definitionFingerprint === definitionFingerprint(d) &&
    Buffer.byteLength(JSON.stringify(d), 'utf8') <= 32768 &&
    (d.state === 'DRAFT'
      ? noApproval && d.revokedBy === null && d.revokedAt === null
      : d.state === 'APPROVED'
        ? approval && d.revokedBy === null && d.revokedAt === null
        : revoked && (approval || noApproval))
  );
}
export const checkpointDefinitionRecord = z
  .strictObject(shape)
  .refine(validCheckpointDefinition);
export const checkpointDefinitionIndex = {
  collection: 'visualizationCheckpointDefinitions',
  name: 'uq_visual_checkpoint_version',
  key: { visualizationId: 1, checkpointId: 1, checkpointVersion: 1 },
  unique: true,
} as const;
const schema = new Schema<CheckpointDefinition>(
  {},
  {
    ...evidenceSchemaOptions,
    collection: checkpointDefinitionIndex.collection,
  },
);
for (const key of Object.keys(shape)) {
  const refs = [
    '_id',
    'conceptId',
    'visualizationId',
    'authoredBy',
    'approvedBy',
    'revokedBy',
  ];
  const dates = ['authoredAt', 'approvedAt', 'revokedAt'];
  const numbers = [
    'schemaVersion',
    'checkpointVersion',
    'policyVersion',
    'verifierVersion',
    'decisionFence',
  ];
  if (key === 'choices') {
    schema.add({
      choices: {
        type: [
          new Schema(
            {
              id: { type: String, cast: false, required: true },
              label: { type: String, cast: false, required: true },
            },
            { _id: false, strict: 'throw' },
          ),
        ],
        required: true,
        default: undefined,
        immutable: true,
      },
    });
    continue;
  }
  const mutable = [
    'state',
    'decisionFence',
    'approvedBy',
    'approvedAt',
    'approvedFingerprint',
    'revokedBy',
    'revokedAt',
  ];
  const nullable = [
    'approvedBy',
    'approvedAt',
    'approvedFingerprint',
    'revokedBy',
    'revokedAt',
  ];
  schema.add({
    [key]: {
      type: refs.includes(key)
        ? Schema.Types.ObjectId
        : dates.includes(key)
          ? Date
          : numbers.includes(key)
            ? Number
            : String,
      cast: false,
      required: !nullable.includes(key),
      immutable: !mutable.includes(key),
      ...(nullable.includes(key) ? { default: null } : {}),
      ...([
        'expectedChoiceId',
        'definitionFingerprint',
        'approvedFingerprint',
      ].includes(key)
        ? { select: false }
        : {}),
    },
  });
}
schema.index(checkpointDefinitionIndex.key, {
  name: checkpointDefinitionIndex.name,
  unique: true,
});
schema.pre('validate', function () {
  checkpointDefinitionRecord.parse(
    this.toObject({ getters: false, virtuals: false, transform: false }),
  );
});
guardEvidenceWrites(schema);
const Model = mongoose.model<CheckpointDefinition>(
  'VisualizationCheckpointDefinition',
  schema,
);
export class VisualizationCheckpointDefinition extends Model {
  constructor(row: CheckpointDefinition) {
    super(checkpointDefinitionRecord.parse(row));
  }
}
