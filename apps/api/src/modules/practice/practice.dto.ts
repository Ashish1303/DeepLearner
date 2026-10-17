import { Types } from 'mongoose';
import { z } from 'zod';
const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const text = z
  .string()
  .min(1)
  .max(50000)
  .refine((value) => value.trim().length > 0);
const dto = z
  .strictObject({
    id,
    conceptId: id,
    type: z.literal('OUTPUT'),
    difficulty: z.enum([
      'BEGINNER',
      'INTERMEDIATE',
      'ADVANCED',
      'INTERVIEW_READY',
    ]),
    prompt: text.refine((value) => value === value.trim()),
    starterCode: text.nullable(),
    language: z.enum(['JAVASCRIPT', 'TYPESCRIPT']).nullable(),
  })
  .refine((value) => value.starterCode === null || value.language !== null);
export type PracticeDto = z.output<typeof dto>;
export type ProjectedPractice = Record<string, unknown>;
// Explicit construction remains mandatory even when the query already projects.
export function practiceDto(record: ProjectedPractice): PracticeDto {
  const identity = (value: unknown) =>
    value instanceof Types.ObjectId ? value.toHexString() : value;
  return dto.parse({
    id: identity(record._id),
    conceptId: identity(record.conceptId),
    type: record.type,
    difficulty: record.difficulty,
    prompt: record.prompt,
    starterCode: record.starterCode === undefined ? null : record.starterCode,
    language: record.language === undefined ? null : record.language,
  });
}
