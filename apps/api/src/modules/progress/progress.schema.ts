import { z } from 'zod';
export const progressId = z
  .string()
  .regex(/^[a-fA-F0-9]{24}(?![\s\S])/)
  .transform((value) => value.toLowerCase());
export const progressQuery = z.strictObject({ conceptId: progressId });
export const progressRequest = z.strictObject({
  params: z.strictObject({}),
  query: progressQuery,
  body: z.undefined().optional(),
});
