import { z } from 'zod';

export const logoutRequest = z.strictObject({
  body: z.strictObject({}).optional(),
  params: z.strictObject({}),
  query: z.strictObject({}),
});
