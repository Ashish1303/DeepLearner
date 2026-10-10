import { z } from 'zod';
const objectId = z.string().regex(/^[a-fA-F0-9]{24}(?![\s\S])/);
const integer = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const topicQuery = z
  .strictObject({
    moduleId: objectId,
    page: integer.default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), {
    path: ['page'],
  });
export type TopicQuery = z.output<typeof topicQuery>;
export const topicListRequest = z.object({
  query: topicQuery,
  params: z.strictObject({}),
});
export const topicDetailRequest = z.object({
  query: z.strictObject({}),
  params: z.strictObject({ id: objectId }),
});
