import { z } from 'zod';
import {
  proposalContent,
  proposalInvalid,
  validateProposalRecord,
} from './admin-learning-path-proposal.schema.js';

const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const dto = z.strictObject({
  id,
  proposalId: id,
  technologyId: id,
  revision: positive,
  schemaVersion: z.literal(1),
  ...proposalContent,
  source: z.strictObject({ id, revision: positive }),
  createdAt: z.string().refine((v) => {
    const date = new Date(v);
    return Number.isFinite(date.getTime()) && date.toISOString() === v;
  }),
});
export type AdminLearningPathProposalDto = z.output<typeof dto>;

/** Validate raw data before omitting the two explicitly private digests. */
export function adminLearningPathProposalDto(
  input: unknown,
  expected: unknown,
): AdminLearningPathProposalDto {
  try {
    const row = validateProposalRecord(input, expected);
    return dto.parse({
      id: row._id,
      proposalId: row.proposalId,
      technologyId: row.technologyId,
      revision: row.revision,
      schemaVersion: row.schemaVersion,
      title: row.title,
      objectives: [...row.objectives],
      audience: row.audience,
      depth: row.depth,
      runtime:
        row.runtime === null
          ? null
          : { name: row.runtime.name, version: row.runtime.version },
      technologyVersion: row.technologyVersion,
      prerequisites: row.prerequisites.map((p) => ({
        description: p.description,
      })),
      source: { id: row.source.id, revision: row.source.revision },
      createdAt: row.createdAt.toISOString(),
    });
  } catch {
    throw proposalInvalid();
  }
}
