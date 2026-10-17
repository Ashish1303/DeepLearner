import { z } from 'zod';
export const practiceId = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/);
const text = z
  .string()
  .min(1)
  .max(50000)
  .refine((value) => value.trim().length > 0);
export const practiceItem = z
  .strictObject({
    id: practiceId,
    conceptId: practiceId,
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
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const practiceEnvelope = z
  .strictObject({
    success: z.literal(true),
    data: z.array(practiceItem).max(20),
    message: z.null(),
    meta: z.strictObject({
      requestId: z.string().min(1),
      page: count.min(1),
      limit: count.min(1).max(20),
      total: count,
      totalPages: count,
    }),
  })
  .refine(({ data, meta }) => {
    const skip = (meta.page - 1) * meta.limit;
    return (
      Number.isSafeInteger(skip) &&
      meta.totalPages === Math.ceil(meta.total / meta.limit) &&
      data.length === Math.min(meta.limit, Math.max(0, meta.total - skip)) &&
      data.every((item, index) => index === 0 || data[index - 1]!.id < item.id)
    );
  });
export type PracticeItem = z.output<typeof practiceItem>;
export type PracticePage = z.output<typeof practiceEnvelope>;
export const DRAFT_LENGTH = 10000;
export const DRAFT_CAPACITY = 100;
