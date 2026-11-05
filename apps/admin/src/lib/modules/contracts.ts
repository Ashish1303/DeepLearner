import { z } from 'zod';
import { technologyId, pagination } from '../technologies/contracts';
export { pagination } from '../technologies/contracts';

export const moduleQuery = z
  .strictObject({
    technologyId,
    learningPathId: technologyId,
    page: z.number().int().min(1).max(10001),
    limit: z.number().int().min(1).max(100),
  })
  .refine(
    (v) =>
      Number.isSafeInteger((v.page - 1) * v.limit) &&
      (v.page - 1) * v.limit <= 10000,
  );
export const moduleRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('list'), query: moduleQuery }),
  z.strictObject({
    kind: z.literal('detail'),
    id: technologyId,
    technologyId,
    learningPathId: technologyId,
  }),
]);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timestamp = z.iso
  .datetime()
  .refine(
    (v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v,
  );
export const moduleDto = z
  .strictObject({
    id: technologyId,
    technologyId,
    learningPathId: technologyId,
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
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    order: integer,
    revision: integer,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((v) => Date.parse(v.updatedAt) >= Date.parse(v.createdAt));
export const modulePage = z.strictObject({
  items: z.array(moduleDto).max(100),
  pagination,
});
export type Module = z.infer<typeof moduleDto>;
export type ModulePage = z.infer<typeof modulePage>;
export type ModuleRequest = z.infer<typeof moduleRequest>;
export type ModuleResult = Module | ModulePage;
export function validateModulePage(
  raw: unknown,
  query: z.infer<typeof moduleQuery>,
): ModulePage {
  const { items, pagination: meta } = modulePage.parse(raw);
  const offset = (query.page - 1) * query.limit;
  if (
    meta.page !== query.page ||
    meta.limit !== query.limit ||
    meta.totalPages !== Math.ceil(meta.total / meta.limit) ||
    items.length !== Math.min(query.limit, Math.max(0, meta.total - offset)) ||
    new Set(items.map((v) => v.id)).size !== items.length ||
    new Set(items.map((v) => v.slug)).size !== items.length ||
    items.some(
      (v) =>
        v.technologyId !== query.technologyId ||
        v.learningPathId !== query.learningPathId,
    ) ||
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
    throw Error('INVALID_MODULE_PAGE');
  return { items, pagination: meta };
}
