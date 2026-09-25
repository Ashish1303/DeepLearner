import { z } from 'zod';

const schema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z
    .url()
    .refine(
      (value) => ['http:', 'https:'].includes(new URL(value).protocol),
      'Expected an HTTP(S) API URL',
    )
    .default('http://localhost:4000/api/v1'),
});

// Explicit access is required for Next.js to inline public build-time values.
const result = schema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
if (!result.success)
  throw new Error('Invalid web configuration: NEXT_PUBLIC_API_BASE_URL');

export const env = result.data;
