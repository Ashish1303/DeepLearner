import { validateCurriculumBriefStructure } from '../admin/learning-paths/admin-curriculum-brief.schema.js';
import {
  curriculumOutlineByteLimit,
  curriculumOutlineSchema,
  type CurriculumOutline,
} from './curriculum-outline.schema.js';

export type CurriculumOutlineValidation =
  | Readonly<{ ok: true; outline: CurriculumOutline }>
  | Readonly<{
      ok: false;
      code: 'INVALID_OUTLINE';
      message: 'Curriculum outline is invalid';
    }>;

const invalid = Object.freeze({
  ok: false as const,
  code: 'INVALID_OUTLINE' as const,
  message: 'Curriculum outline is invalid' as const,
});

/**
 * Local structure/integrity only. The supplied brief is not authenticated here.
 * A valid result proves no AI provenance, content quality, admission or authority.
 * No provider, storage, clock, identity generation or runtime registration is used.
 */
export function validateCurriculumOutline(
  inputJson: unknown,
  expectedBrief: unknown,
): CurriculumOutlineValidation {
  try {
    if (
      typeof inputJson !== 'string' ||
      Buffer.byteLength(inputJson, 'utf8') > curriculumOutlineByteLimit
    )
      return invalid;
    const brief = validateCurriculumBriefStructure(expectedBrief);
    const outline = curriculumOutlineSchema.parse(JSON.parse(inputJson));
    if (
      outline.technologyId !== brief.technologyId ||
      outline.source.id !== brief._id ||
      outline.source.revision !== brief.revision ||
      outline.source.digest !== brief.contentDigest
    )
      return invalid;
    return Object.freeze({ ok: true, outline });
  } catch {
    return invalid;
  }
}
