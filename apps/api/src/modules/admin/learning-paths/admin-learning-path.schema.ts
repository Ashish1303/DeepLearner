import { z } from 'zod';

const end = '(?![\\s\\S])';
export const adminLearningPathId = z
  .string()
  .regex(new RegExp('^[a-fA-F0-9]{24}' + end))
  .transform((value) => value.toLowerCase());
const integer = z
  .string()
  .regex(new RegExp('^[1-9][0-9]*' + end))
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const adminLearningPathQuery = z
  .strictObject({
    technologyId: adminLearningPathId,
    page: integer.pipe(z.number().max(10001)).default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(
    ({ page, limit }) =>
      Number.isSafeInteger((page - 1) * limit) && (page - 1) * limit <= 10000,
  );
export const adminLearningPathDetailQuery = z.strictObject({
  technologyId: adminLearningPathId,
});
export const adminLearningPathListRequest = z.strictObject({
  query: adminLearningPathQuery,
  params: z.strictObject({}),
  body: z.strictObject({}).optional(),
});
export const adminLearningPathDetailRequest = z.strictObject({
  query: adminLearningPathDetailQuery,
  params: z.strictObject({ id: adminLearningPathId }),
  body: z.strictObject({}).optional(),
});
export type AdminLearningPathQuery = z.output<typeof adminLearningPathQuery>;
