import { Types } from 'mongoose';
import { z } from 'zod';
import { createHash } from 'node:crypto';
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
    type: z.enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']),
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

const authoredAnswer = text.refine(
  (value) => value === value.trim() && value.length <= 50000,
);
const unlockDto = z.strictObject({
  id,
  conceptId: id,
  type: z.enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']),
  answer: authoredAnswer,
  explanation: authoredAnswer.nullable(),
});
export type PracticeAnswerDto = z.output<typeof unlockDto>;
export function practiceAnswerDto(
  record: ProjectedPractice,
): PracticeAnswerDto {
  const identity = (value: unknown) =>
    value instanceof Types.ObjectId ? value.toHexString() : value;
  return unlockDto.parse({
    id: identity(record._id),
    conceptId: identity(record.conceptId),
    type: record.type,
    answer: record.answer,
    explanation:
      record.explanation === undefined
        ? null
        : authoredAnswer.parse(record.explanation),
  });
}
export const sha256 = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
export function questionRevision(item: PracticeDto) {
  return sha256(
    JSON.stringify([
      'F036-public-v1',
      item.id,
      item.conceptId,
      item.type,
      item.difficulty,
      item.prompt,
      item.starterCode,
      item.language,
    ]),
  );
}
export type QualifiedPractice = {
  data: PracticeAnswerDto;
  questionRevision: string;
  contentFingerprint: string;
};
export function qualifiedPractice(
  record: ProjectedPractice,
  parent: ProjectedPractice,
): QualifiedPractice {
  const hex = (value: unknown) =>
    id.parse(value instanceof Types.ObjectId ? value.toHexString() : value);
  const data = practiceAnswerDto(record),
    revision = questionRevision(practiceDto(record));
  if (record.schemaVersion !== 1) throw new Error('Invalid question version');
  return {
    data,
    questionRevision: revision,
    contentFingerprint: sha256(
      JSON.stringify([
        'F036-content-v1',
        revision,
        hex(record.topicId),
        hex(parent.moduleId),
        hex(parent.learningPathId),
        hex(record.technologyId),
        1,
        data.answer,
        data.explanation,
      ]),
    ),
  };
}
const receipt = z.strictObject({
  id,
  attemptNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  result: z.literal('SUBMITTED'),
  submittedAt: z.iso.datetime({ precision: 3 }),
});
export type AttemptReceipt = z.output<typeof receipt>;
export type PracticeUnlockOutcome = {
  data: PracticeAnswerDto;
  attempt: AttemptReceipt;
};
export function attemptReceipt(record: {
  _id: Types.ObjectId;
  attemptNumber: number;
  result: string;
  submittedAt: Date;
}): AttemptReceipt {
  return receipt.parse({
    id: record._id.toHexString(),
    attemptNumber: record.attemptNumber,
    result: record.result,
    submittedAt: record.submittedAt.toISOString(),
  });
}
