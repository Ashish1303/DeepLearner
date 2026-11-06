import { z } from 'zod';

const end = '(?![\\s\\S])';
export const adminModuleId = z
  .string()
  .regex(new RegExp('^[a-fA-F0-9]{24}' + end))
  .transform((value) => value.toLowerCase());
const integer = z
  .string()
  .regex(new RegExp('^[1-9][0-9]*' + end))
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const adminModuleQuery = z
  .strictObject({
    technologyId: adminModuleId,
    learningPathId: adminModuleId,
    page: integer.pipe(z.number().max(10001)).default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(
    ({ page, limit }) =>
      Number.isSafeInteger((page - 1) * limit) && (page - 1) * limit <= 10000,
  );
export const adminModuleDetailQuery = z.strictObject({
  technologyId: adminModuleId,
  learningPathId: adminModuleId,
});
export const adminModuleListRequest = z.strictObject({
  query: adminModuleQuery,
  params: z.strictObject({}),
  body: z.strictObject({}).optional(),
});
export const adminModuleDetailRequest = z.strictObject({
  query: adminModuleDetailQuery,
  params: z.strictObject({ id: adminModuleId }),
  body: z.strictObject({}).optional(),
});
export type AdminModuleQuery = z.output<typeof adminModuleQuery>;
