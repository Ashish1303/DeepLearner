import { z } from 'zod';
const objectId = z.string().regex(/^[a-fA-F0-9]{24}(?![\s\S])/);
const integer = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const moduleQuery = z
  .strictObject({
    learningPathId: objectId,
    page: integer.default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
  });
export type ModuleQuery = z.output<typeof moduleQuery>;
export const moduleListRequest = z.object({
  query: moduleQuery,
  params: z.strictObject({}),
});
export const moduleDetailRequest = z.object({
  query: z.strictObject({}),
  params: z.strictObject({ id: objectId }),
});
