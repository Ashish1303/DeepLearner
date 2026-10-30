import { z } from 'zod';

const end = '(?![\\s\\S])';
export const technologyId = z
  .string()
  .regex(new RegExp('^[a-fA-F0-9]{24}' + end))
  .transform((id) => id.toLowerCase());
const name = z.string().trim().min(1).max(80);
const slug = z
  .string()
  .min(1)
  .max(100)
  .regex(new RegExp('^[a-z0-9]+(?:-[a-z0-9]+)*' + end));
const order = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const description = z.string().max(2000).nullable();
export const createTechnologyInput = z.strictObject({
  name,
  slug,
  description: description.optional(),
  order: order.default(0),
});
export const patchTechnologyInput = z
  .strictObject({
    revision: order.max(Number.MAX_SAFE_INTEGER - 1),
    name: name.optional(),
    description: description.optional(),
    order: order.optional(),
  })
  .refine((value) =>
    ['name', 'description', 'order'].some((key) => Object.hasOwn(value, key)),
  );
const integer = z
  .string()
  .regex(new RegExp('^[1-9][0-9]*' + end))
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
export const adminTechnologyQuery = z
  .strictObject({
    page: integer.default(1),
    limit: integer.pipe(z.number().max(100)).default(20),
  })
  .refine(
    ({ page, limit }) =>
      Number.isSafeInteger((page - 1) * limit) && (page - 1) * limit <= 10000,
  );
export const technologyListRequest = z.strictObject({
  query: adminTechnologyQuery,
  params: z.strictObject({}),
  body: z.strictObject({}).optional(),
});
export const technologyDetailRequest = z.strictObject({
  query: z.strictObject({}),
  params: z.strictObject({ id: technologyId }),
  body: z.strictObject({}).optional(),
});
export const technologyCreateRequest = z.strictObject({
  query: z.strictObject({}),
  params: z.strictObject({}),
  body: createTechnologyInput,
});
export const technologyPatchRequest = z.strictObject({
  query: z.strictObject({}),
  params: z.strictObject({ id: technologyId }),
  body: patchTechnologyInput,
});
export type AdminTechnologyQuery = z.output<typeof adminTechnologyQuery>;
export type CreateTechnologyInput = z.input<typeof createTechnologyInput>;
export type PatchTechnologyInput = z.output<typeof patchTechnologyInput>;
