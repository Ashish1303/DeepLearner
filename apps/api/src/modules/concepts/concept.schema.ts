import { z } from 'zod';
const objectId = z.string().regex(/^[a-fA-F0-9]{24}(?![\s\S])/);
const integer = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const conceptQuery = z
  .strictObject({
    topicId: objectId,
    page: integer.default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
  });
export type ConceptQuery = z.output<typeof conceptQuery>;
export const conceptListRequest = z.object({
  query: conceptQuery,
  params: z.strictObject({}),
});
export const conceptDetailRequest = z.object({
  query: z.strictObject({}),
  params: z.strictObject({ id: objectId }),
});
