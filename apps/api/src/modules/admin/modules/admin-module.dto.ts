import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/errors/app-error.js';

export const moduleUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Module inspection is temporarily unavailable',
  );
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const status = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const parent = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  technologyId: z.instanceof(Types.ObjectId),
  status,
});
const record = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  technologyId: z.instanceof(Types.ObjectId),
  learningPathId: z.instanceof(Types.ObjectId),
  title: z
    .string()
    .min(1)
    .max(120)
    .refine((value) => value.trim() === value && value.trim().length > 0),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  description: z.string().max(2000).nullable().optional(),
  status,
  order: integer,
  __v: integer,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const moduleProjection = Object.freeze(
  Object.fromEntries(Object.keys(record.shape).map((key) => [key, 1])),
);
export function validateModuleParent(
  value: unknown,
  technologyId: string,
  learningPathId: string,
) {
  const parsed = parent.safeParse(value);
  if (
    !parsed.success ||
    parsed.data._id.toHexString() !== learningPathId ||
    parsed.data.technologyId.toHexString() !== technologyId
  )
    throw moduleUnavailable();
}
export function adminModuleDto(value: unknown) {
  const parsed = record.safeParse(value);
  if (!parsed.success || parsed.data.updatedAt < parsed.data.createdAt)
    throw moduleUnavailable();
  const row = parsed.data;
  return {
    id: row._id.toHexString(),
    technologyId: row.technologyId.toHexString(),
    learningPathId: row.learningPathId.toHexString(),
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    status: row.status,
    order: row.order,
    revision: row.__v,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type AdminModuleDto = ReturnType<typeof adminModuleDto>;
