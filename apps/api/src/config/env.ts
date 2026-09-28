import { z } from 'zod';
import { databaseTLS } from './database.js';

const origin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected an exact HTTP(S) origin without a path or trailing slash');

const schema = z
  .object({
    MONGODB_URI: z
      .string()
      .min(1)
      .refine((value) => {
        if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(value) || /[<>]/.test(value))
          return false;
        return true;
      }),
    MONGODB_TLS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    MONGODB_DB_NAME: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{1,63}$/)
      .refine(
        (value) => !['admin', 'local', 'config'].includes(value.toLowerCase()),
      ),
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
    try {
      databaseTLS(value);
    } catch {
      context.addIssue({
        code: 'custom',
        path: ['MONGODB_URI'],
        message: 'Invalid database TLS policy',
      });
    }
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
