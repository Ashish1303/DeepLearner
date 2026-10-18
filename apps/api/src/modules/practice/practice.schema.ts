import { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
const integer = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const practiceQuery = z
  .strictObject({
    conceptId: z
      .string()
      .regex(/^[a-fA-F0-9]{24}(?![\s\S])/)
      .transform((value) => value.toLowerCase()),
    type: z
      .enum(['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'])
      .default('OUTPUT'),
    page: integer.default(1),
    limit: integer.pipe(z.number().max(20)).default(10),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
  });
export type PracticeQuery = z.output<typeof practiceQuery>;
export const practiceListRequest = z.object({
  query: practiceQuery,
  params: z.strictObject({}),
  body: z.undefined().optional(),
});

export const submittedAnswer = z
  .string()
  .min(1)
  .max(10000)
  .refine((value) => value.length <= 10000)
  .refine((value) => value.trim().length > 0);
const unlockId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}(?![\s\S])/)
  .transform((value) => value.toLowerCase());
export const practiceUnlockRequest = z.strictObject({
  params: z.strictObject({ questionId: unlockId }),
  query: z.strictObject({}),
  body: z.strictObject({
    conceptId: unlockId,
    studentAnswer: submittedAnswer,
    questionRevision: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  }),
});
export const idempotencyKey = z
  .string()
  .length(36)
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?![\s\S])/,
  );
export function readIdempotencyKey(headers: string[]): string {
  const values = headers.filter(
    (_value, index) =>
      index % 2 === 0 && headers[index]!.toLowerCase() === 'idempotency-key',
  ).length;
  const index = headers.findIndex(
    (value, i) => i % 2 === 0 && value.toLowerCase() === 'idempotency-key',
  );
  const parsed = idempotencyKey.safeParse(
    index < 0 ? undefined : headers[index + 1],
  );
  if (values !== 1 || !parsed.success)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'One valid Idempotency-Key is required',
    );
  return parsed.data;
}
export type PracticeUnlockInput = {
  questionId: string;
  conceptId: string;
  studentAnswer: string;
  questionRevision: string;
  idempotencyKey: string;
};
