import { createHash } from 'node:crypto';
import { Types } from 'mongoose';
import { z } from 'zod';
import {
  assertProposalByteLimit,
  proposalContent,
  proposalData,
  type ProposalBinding,
} from './admin-learning-path-proposal.schema.js';

export const briefInvalid = () => new Error('Invalid curriculum brief');
const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const reference = z.union([
  id,
  z.instanceof(Types.ObjectId).transform((value) => value.toHexString()),
]);
const operation = z
  .string()
  .regex(
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/,
  );
const definition = z.strictObject({
  _id: reference,
  technologyId: reference,
  schemaVersion: z.literal(1),
  revision: z.literal(1),
  ...proposalContent,
  createdBy: reference,
  createdAt: z.date(),
  operationId: operation,
});
const record = definition.extend({
  contentDigest: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
});
export type CurriculumBriefRecord = z.output<typeof record>;
type Definition = z.output<typeof definition>;

/** A byte bound only; neither valid content nor admission is established here. */
export function assertBriefByteLimit(encoded: unknown): void {
  try {
    assertProposalByteLimit(encoded);
  } catch {
    throw briefInvalid();
  }
}

function hash(row: Definition): string {
  const bytes = JSON.stringify([
    'F044-admin-brief-v1',
    row._id,
    row.technologyId,
    1,
    1,
    row.title,
    row.objectives,
    row.audience,
    row.depth,
    row.runtime === null ? null : [row.runtime.name, row.runtime.version],
    row.technologyVersion,
    row.prerequisites.map((item) => item.description),
    row.createdBy,
    row.createdAt.toISOString(),
    row.operationId,
  ]);
  assertBriefByteLimit(bytes);
  const digest = createHash('sha256').update(bytes, 'utf8').digest('hex');
  assertBriefByteLimit(JSON.stringify({ ...row, contentDigest: digest }));
  return digest;
}

/** Input excludes its digest. Does not generate identities/time or consult storage. */
export function curriculumBriefDigest(input: unknown): string {
  try {
    return hash(definition.parse(proposalData(input)));
  } catch {
    throw briefInvalid();
  }
}

/** Strict local structure/integrity only, never authenticated source admission. */
export function validateCurriculumBriefStructure(
  input: unknown,
): CurriculumBriefRecord {
  try {
    const row = record.parse(proposalData(input));
    if (row.contentDigest !== hash(row)) throw briefInvalid();
    return row;
  } catch {
    throw briefInvalid();
  }
}

/** Expected Technology is separate caller context, not proof that it exists. */
export function validateCurriculumBriefRecord(
  input: unknown,
  expectedTechnologyId: unknown,
): CurriculumBriefRecord {
  try {
    const row = validateCurriculumBriefStructure(input);
    if (row.technologyId !== id.parse(proposalData(expectedTechnologyId)))
      throw briefInvalid();
    return row;
  } catch {
    throw briefInvalid();
  }
}

/** Internal C1 binding, not a DTO, authorization capability or admission receipt. */
export function curriculumBriefProposalBinding(
  input: unknown,
  expectedTechnologyId: unknown,
): ProposalBinding {
  const row = validateCurriculumBriefRecord(input, expectedTechnologyId);
  return {
    technologyId: row.technologyId,
    source: { id: row._id, revision: 1, digest: row.contentDigest },
  };
}
