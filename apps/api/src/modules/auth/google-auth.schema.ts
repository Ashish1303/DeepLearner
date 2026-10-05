import { z } from 'zod';
export const googleAuthRequest = z.strictObject({
  body: z.strictObject({ credential: z.string().min(1).max(16384) }),
  params: z.strictObject({}),
  query: z.strictObject({}),
});
