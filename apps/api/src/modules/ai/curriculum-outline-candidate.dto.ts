import {
  freezeOutline,
  validateOutlineCandidate,
} from './curriculum-outline-candidate.schema.js';

/** Private projection only. Valid structure is not authorization to disclose it. */
export function outlineCandidateDto(input: unknown) {
  const row = validateOutlineCandidate(input);
  return freezeOutline({
    id: row._id,
    outlineId: row.outlineId,
    revision: row.revision,
    origin: row.origin,
    outline: row.outline,
    contentDigest: row.contentDigest,
    definitionDigest: row.definitionDigest,
    createdAt: row.createdAt,
  });
}
export type OutlineCandidateDto = ReturnType<typeof outlineCandidateDto>;
