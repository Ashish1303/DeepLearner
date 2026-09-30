import { z } from 'zod';
import { normalizedEmail } from './auth.schema.js';
export const loginBody = z.strictObject({
  email: normalizedEmail,
  password: z.string().min(10).max(128),
});
export const loginRequest = z.strictObject({
  body: loginBody,
  params: z.strictObject({}),
  query: z.strictObject({}),
});
export const refreshRequest = z.strictObject({
  body: z.strictObject({}).optional(),
  params: z.strictObject({}),
  query: z.strictObject({}),
});
export type LoginInput = z.infer<typeof loginBody>;
