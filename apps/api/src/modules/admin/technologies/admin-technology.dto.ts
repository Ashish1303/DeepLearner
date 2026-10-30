import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/errors/app-error.js';

export const technologyUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Technology management is temporarily unavailable',
  );
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const record = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  name: z
    .string()
    .min(1)
    .max(80)
    .refine((s) => s.trim() === s && s.trim().length > 0),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/),
  description: z.string().max(2000).nullable().optional(),
  iconAssetId: z.instanceof(Types.ObjectId).nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  order: integer,
  __v: integer,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const technologyProjection = Object.freeze(
  Object.fromEntries(Object.keys(record.shape).map((key) => [key, 1])),
);
export function adminTechnologyDto(value: unknown) {
  const parsed = record.safeParse(value);
  if (!parsed.success || parsed.data.updatedAt < parsed.data.createdAt)
    throw technologyUnavailable();
  const row = parsed.data;
  return {
    id: row._id.toHexString(),
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    iconAssetId: row.iconAssetId?.toHexString() ?? null,
    status: row.status,
    order: row.order,
    revision: row.__v,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type AdminTechnologyDto = ReturnType<typeof adminTechnologyDto>;
