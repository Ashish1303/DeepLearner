import { z } from 'zod';
const id = z.string().regex(/^[a-f0-9]{24}(?![\s\S])/i);
export const catalogPageNumber = z
  .number()
  .int()
  .positive()
  .refine((value) => Number.isSafeInteger((value - 1) * 20));
export const technologySchema = z.object({
  id,
  name: z.string().min(1).max(80),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  description: z.string().max(2000).nullable(),
  iconAssetId: id.nullable(),
  order: z.number().int().nonnegative(),
});
export const catalogResponseSchema = z.object({
  success: z.literal(true),
  message: z.string().nullable(),
  data: z
    .array(technologySchema)
    .max(20)
    .refine(
      (items) =>
        new Set(items.map((item) => item.id.toLowerCase())).size ===
        items.length,
    ),
  meta: z
    .object({
      requestId: z.string().min(1),
      page: catalogPageNumber,
      limit: z.literal(20),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    })
    .refine((meta) => meta.totalPages === Math.ceil(meta.total / meta.limit)),
});
export type Technology = z.infer<typeof technologySchema>;
export type CatalogPage = z.infer<typeof catalogResponseSchema>;
