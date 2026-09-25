import { z } from 'zod';

const schema = z.object({
  VITE_API_BASE_URL: z
    .url()
    .refine(
      (value) => ['http:', 'https:'].includes(new URL(value).protocol),
      'Expected an HTTP(S) API URL',
    )
    .default('http://localhost:4000/api/v1'),
});

const result = schema.safeParse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});
if (!result.success)
  throw new Error('Invalid admin configuration: VITE_API_BASE_URL');

export const env = result.data;
