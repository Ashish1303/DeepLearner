import { z } from 'zod';
const integer = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const technologyQuery = z
  .strictObject({
    page: integer.default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
  });
export type TechnologyQuery = z.output<typeof technologyQuery>;
export const technologyRequest = z.object({
  query: technologyQuery,
  params: z.strictObject({}),
});
