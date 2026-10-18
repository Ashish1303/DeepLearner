import { z } from 'zod';
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
