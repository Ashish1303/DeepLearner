import { z } from 'zod';

const end = '(?![\\s\\S])';
export const technologyId = z.string().regex(new RegExp('^[a-f0-9]{24}' + end));
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const name = z.string().trim().min(1).max(80);
const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(new RegExp('^[a-z0-9]+(?:-[a-z0-9]+)*' + end));
const order = integer;
export const technologyCreate = z.strictObject({
  name,
  slug,
  description: z.string().max(2000).nullable().optional(),
  order: order.optional(),
});
export const technologyPatch = z
  .strictObject({
    revision: integer.max(Number.MAX_SAFE_INTEGER - 1),
    name: name.optional(),
    description: z.string().max(2000).nullable().optional(),
    order: order.optional(),
  })
  .refine((v) =>
    ['name', 'description', 'order'].some((k) => Object.hasOwn(v, k)),
  );
export const technologyQuery = z
  .strictObject({
    page: z.number().int().positive().max(10001),
    limit: z.number().int().positive().max(100),
  })
  .refine(
    (v) =>
      Number.isSafeInteger((v.page - 1) * v.limit) &&
      (v.page - 1) * v.limit <= 10000,
  );
export const technologyRequest = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('list'), query: technologyQuery }),
  z.strictObject({ kind: z.literal('detail'), id: technologyId }),
  z.strictObject({ kind: z.literal('create'), input: technologyCreate }),
  z.strictObject({
    kind: z.literal('patch'),
    id: technologyId,
    input: technologyPatch,
  }),
]);
const timestamp = z.iso
  .datetime()
  .refine(
    (v) => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v,
  );
export const technologyDto = z
  .strictObject({
    id: technologyId,
    name: z
      .string()
      .min(1)
      .max(80)
      .refine((v) => v.trim() === v && v.trim().length > 0),
    slug,
    description: z.string().max(2000).nullable(),
    iconAssetId: technologyId.nullable(),
    status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
    order,
    revision: integer,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((v) => Date.parse(v.updatedAt) >= Date.parse(v.createdAt));
export const pagination = z.strictObject({
  page: z.number().int().positive().max(10001),
  limit: z.number().int().positive().max(100),
  total: integer,
  totalPages: integer,
});
export type Technology = z.infer<typeof technologyDto>;
export type TechnologyRequest = z.infer<typeof technologyRequest>;
export type TechnologyPage = {
  items: Technology[];
  pagination: z.infer<typeof pagination>;
};
export const technologyPage = z.strictObject({
  items: z.array(technologyDto).max(100),
  pagination,
});
export type TechnologyResult = TechnologyPage | Technology;
export function validateTechnologyForm(
  fields: { name: string; slug: string; description: string; order: string },
  initial: Technology | null,
) {
  const errors: Partial<Record<keyof typeof fields, string>> = {};
  if (!fields.name.trim() || fields.name.trim().length > 80)
    errors.name = 'Enter a name between 1 and 80 characters.';
  if (!initial && !slug.safeParse(fields.slug).success)
    errors.slug =
      'Use 1–100 lowercase letters or numbers separated by single hyphens.';
  if (fields.description.length > 2000)
    errors.description = 'Use no more than 2,000 characters.';
  if (
    !/^(0|[1-9][0-9]{0,15})(?![\s\S])/.test(fields.order) ||
    !Number.isSafeInteger(Number(fields.order))
  )
    errors.order =
      'Enter a nonnegative whole number within the safe integer range.';
  const input = initial
    ? {
        revision: initial.revision,
        name: fields.name.trim(),
        description: fields.description || null,
        order: Number(fields.order),
      }
    : {
        name: fields.name.trim(),
        slug: fields.slug,
        description: fields.description || null,
        order: Number(fields.order),
      };
  if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 4096)
    errors.description =
      'Reduce the description; the complete UTF-8 request must fit within 4,096 bytes.';
  return errors;
}
export function validateTechnologyPage(
  items: Technology[],
  meta: z.infer<typeof pagination>,
  query: z.infer<typeof technologyQuery>,
): TechnologyPage {
  if (
    meta.page !== query.page ||
    meta.limit !== query.limit ||
    meta.totalPages !== Math.ceil(meta.total / meta.limit) ||
    items.length > meta.limit ||
    new Set(items.map((v) => v.id)).size !== items.length ||
    new Set(items.map((v) => v.slug)).size !== items.length ||
    items.some((v, i) => i > 0 && items[i - 1]!.slug >= v.slug) ||
    (meta.total === 0 && items.length !== 0) ||
    items.length > meta.total ||
    (meta.page > meta.totalPages && items.length !== 0)
  )
    throw Error('INVALID_TECHNOLOGY_PAGE');
  return { items, pagination: meta };
}
