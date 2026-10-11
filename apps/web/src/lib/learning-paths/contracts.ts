import { z } from 'zod';
export const idSchema = z
  .string()
  .regex(/^[a-f0-9]{24}(?![\s\S])/i)
  .transform((value) => value.toLowerCase());
export const pageNumber = z
  .number()
  .int()
  .positive()
  .refine((value) => Number.isSafeInteger((value - 1) * 20));
const common = {
  id: idSchema,
  technologyId: idSchema,
  title: z
    .string()
    .min(1)
    .max(120)
    .refine((value) => value.trim().length > 0),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  description: z.string().max(2000).nullable(),
  order: z.number().int().nonnegative(),
};
export const pathSchema = z.object({
  ...common,
  targetLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).nullable(),
  completionScore: z.number().int().min(0).max(100),
});
export const moduleSchema = z.object({ ...common, learningPathId: idSchema });
export const topicSchema = moduleSchema.extend({ moduleId: idSchema });
export type Path = z.infer<typeof pathSchema>;
export type Module = z.infer<typeof moduleSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type CatalogItem = Path | Module | Topic;
const requestId = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
export function detailEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string().nullable(),
    data: schema,
    meta: z.object({ requestId }),
  });
}
export function listEnvelope<T extends z.ZodType<CatalogItem>>(schema: T) {
  return z
    .object({
      success: z.literal(true),
      message: z.string().nullable(),
      data: z
        .array(schema)
        .max(20)
        .refine(
          (items) =>
            new Set(items.map((item) => item.id)).size === items.length,
        ),
      meta: z
        .object({
          requestId,
          page: pageNumber,
          limit: z.literal(20),
          total: z.number().int().nonnegative(),
          totalPages: z.number().int().nonnegative(),
        })
        .refine((meta) => meta.totalPages === Math.ceil(meta.total / 20)),
    })
    .refine(
      (result) =>
        result.data.length ===
        Math.min(
          20,
          Math.max(0, result.meta.total - (result.meta.page - 1) * 20),
        ),
    );
}
export const errorEnvelope = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string().min(1),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({ requestId }),
});
export interface Crumb {
  title: string;
  href: string;
}
export interface BrowserData {
  title: string;
  description: string | null;
  targetLevel?: Path['targetLevel'];
  crumbs: Crumb[];
  items: CatalogItem[];
  totalPages: number;
}
