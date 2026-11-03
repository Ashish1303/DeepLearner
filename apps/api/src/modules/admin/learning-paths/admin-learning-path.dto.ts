import { Types } from 'mongoose';
import { z } from 'zod';
import { AppError } from '../../../common/errors/app-error.js';

export const learningPathUnavailable = () =>
  new AppError(
    503,
    'DEPENDENCY_UNAVAILABLE',
    'Learning Path inspection is temporarily unavailable',
  );
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const status = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
const parent = z.strictObject({ _id: z.instanceof(Types.ObjectId), status });
const record = z.strictObject({
  _id: z.instanceof(Types.ObjectId),
  technologyId: z.instanceof(Types.ObjectId),
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
  targetLevel: z
    .enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'])
    .nullable()
    .optional(),
  completionScore: z.number().int().min(0).max(100),
  status,
  order: integer,
  __v: integer,
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const learningPathProjection = Object.freeze(
  Object.fromEntries(Object.keys(record.shape).map((key) => [key, 1])),
);
export function validateLearningPathParent(
  value: unknown,
  technologyId: string,
) {
  const parsed = parent.safeParse(value);
  if (!parsed.success || parsed.data._id.toHexString() !== technologyId)
    throw learningPathUnavailable();
}
export function adminLearningPathDto(value: unknown) {
  const parsed = record.safeParse(value);
  if (!parsed.success || parsed.data.updatedAt < parsed.data.createdAt)
    throw learningPathUnavailable();
  const row = parsed.data;
  return {
    id: row._id.toHexString(),
    technologyId: row.technologyId.toHexString(),
    title: row.title,
    slug: row.slug,
    description: row.description ?? null,
    targetLevel: row.targetLevel ?? null,
    completionScore: row.completionScore,
    status: row.status,
    order: row.order,
    revision: row.__v,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
export type AdminLearningPathDto = ReturnType<typeof adminLearningPathDto>;
