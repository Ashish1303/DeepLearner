import { z } from 'zod';

const origin = z.url().refine((value) => {
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected an exact HTTP(S) origin without a path or trailing slash');

const schema = z
  .object({
    APP_ENV: z.enum(['LOCAL', 'DEVELOPMENT', 'PRODUCTION']).default('LOCAL'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:5173')
      .transform((value) => value.split(',').map((entry) => entry.trim()))
      .pipe(z.array(origin).min(1)),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, context) => {
    if (
      value.APP_ENV !== 'LOCAL' &&
      value.CORS_ORIGINS.some((entry) => !entry.startsWith('https://'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['CORS_ORIGINS'],
        message: 'Hosted environments require HTTPS origins',
      });
    }
  });

const result = schema.safeParse(process.env);
if (!result.success) {
  // Report field names only so configuration values cannot leak into startup logs.
  throw new Error(
    `Invalid API configuration: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}

export const env = result.data;
