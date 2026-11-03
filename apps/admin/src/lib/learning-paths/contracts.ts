import { z } from 'zod';
import { technologyId, pagination } from '../technologies/contracts';
export { pagination } from '../technologies/contracts';

export const learningPathQuery = z
  .strictObject({
    technologyId,
    page: z.number().int().min(1).max(10001),
    limit: z.number().int().min(1).max(100),
  })
  .refine(
    (v) =>
      Number.isSafeInteger((v.page - 1) * v.limit) &&
      (v.page - 1) * v.limit <= 10000,
  );
export const learningPathRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('list'), query: learningPathQuery }),
  z.strictObject({ kind: z.literal('detail'), id: technologyId, technologyId }),
]);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso
  .datetime()
  .refine(
    (v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v,
  );
export const learningPathDto = z
  .strictObject({
    id: technologyId,
    technologyId,
    title: z
      .string()
      .min(1)
      .max(120)
      .refine((v) => v.trim() === v && v.trim().length > 0),
    slug: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
    description: z.string().max(2000).nullable(),
    targetLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).nullable(),
    completionScore: z.number().int().min(0).max(100),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    order: integer,
    revision: integer,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((v) => Date.parse(v.updatedAt) >= Date.parse(v.createdAt));
export const learningPathPage = z.strictObject({
  items: z.array(learningPathDto).max(100),
  pagination,
});
export type LearningPath = z.infer<typeof learningPathDto>;
export type LearningPathPage = z.infer<typeof learningPathPage>;
export type LearningPathRequest = z.infer<typeof learningPathRequest>;
export type LearningPathResult = LearningPath | LearningPathPage;
export function validateLearningPathPage(
  raw: unknown,
  query: z.infer<typeof learningPathQuery>,
): LearningPathPage {
  const { items, pagination: meta } = learningPathPage.parse(raw);
  const offset = (query.page - 1) * query.limit;
  if (
    meta.page !== query.page ||
    meta.limit !== query.limit ||
    meta.totalPages !== Math.ceil(meta.total / meta.limit) ||
    items.length !== Math.min(query.limit, Math.max(0, meta.total - offset)) ||
    new Set(items.map((v) => v.id)).size !== items.length ||
    new Set(items.map((v) => v.slug)).size !== items.length ||
    items.some((v) => v.technologyId !== query.technologyId) ||
    items.some((v, i) => {
      if (!i) return false;
      const previous = items[i - 1]!;
      return (
        previous.order > v.order ||
        (previous.order === v.order &&
          (previous.slug > v.slug ||
            (previous.slug === v.slug && previous.id >= v.id)))
      );
    })
  )
    throw Error('INVALID_LEARNING_PATH_PAGE');
  return { items, pagination: meta };
}
