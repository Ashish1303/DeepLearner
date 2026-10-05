import { z } from 'zod';
import { databaseTLS } from './database.js';

const origin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected an exact HTTP(S) origin without a path or trailing slash');

const schema = z
  .object({
    GOOGLE_CLIENT_ID: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/)
      .optional()
      .or(z.literal(''))
      .transform((value) => value || undefined),
    AUTH_GOOGLE_LIMIT: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_GOOGLE_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    ACCESS_TOKEN_SECRET: z.string().refine((value) => {
      const decoded = Buffer.from(value, 'base64');
      return (
        decoded.length >= 32 &&
        decoded.toString('base64') === value &&
        new Set(decoded).size >= 16
      );
    }, 'Independent random base64 signing secret required'),
    ACCESS_TOKEN_ISSUER: z.string().min(1).max(255),
    ACCESS_TOKEN_AUDIENCE: z.string().min(1).max(255),
    AUTH_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    AUTH_FORGOT_LIMIT: z.coerce.number().int().min(1).max(1000).default(3),
    AUTH_FORGOT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(3600000),
    AUTH_RESET_LIMIT: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_RESET_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_CHANGE_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_CHANGE_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_CHANGE_IP_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
    AUTH_CHANGE_IP_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_LOGIN_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_LOGIN_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_LOGIN_IP_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
    AUTH_LOGIN_IP_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_REFRESH_LIMIT: z.coerce.number().int().min(1).max(1000).default(60),
    AUTH_REFRESH_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(60000),
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
    EMAIL_PROVIDER: z.enum(['disabled', 'resend']).default('disabled'),
    EMAIL_FROM: z.string().trim().pipe(z.email()).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    WEB_ORIGIN: origin.default('http://localhost:3000'),
    AUTH_REGISTER_LIMIT: z.coerce.number().int().min(1).max(1000).default(5),
    AUTH_REGISTER_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(3600000),
    AUTH_VERIFY_LIMIT: z.coerce.number().int().min(1).max(1000).default(10),
    AUTH_VERIFY_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(900000),
    AUTH_RESEND_LIMIT: z.coerce.number().int().min(1).max(1000).default(3),
    AUTH_RESEND_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(1000)
      .max(86400000)
      .default(3600000),
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
      !value.AUTH_COOKIE_SECURE &&
      (value.APP_ENV !== 'LOCAL' ||
        value.CORS_ORIGINS.some(
          (entry) =>
            !URL.canParse(entry) ||
            !['localhost', '127.0.0.1', '[::1]'].includes(
              new URL(entry).hostname,
            ),
        ))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message:
          'Insecure cookies require explicit LOCAL loopback configuration',
      });
    }
    if (value.APP_ENV !== 'LOCAL' && value.EMAIL_PROVIDER !== 'resend') {
      context.addIssue({
        code: 'custom',
        path: ['EMAIL_PROVIDER'],
        message: 'Hosted delivery must be configured',
      });
    }
    if (value.EMAIL_PROVIDER === 'resend') {
      for (const key of ['EMAIL_FROM', 'RESEND_API_KEY'] as const) {
        if (!value[key])
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required for email delivery',
          });
      }
    }
    const web = URL.canParse(value.WEB_ORIGIN)
      ? new URL(value.WEB_ORIGIN)
      : undefined;
    if (
      web &&
      web.protocol !== 'https:' &&
      !(
        value.APP_ENV === 'LOCAL' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(web.hostname)
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['WEB_ORIGIN'],
        message: 'HTTPS or local loopback origin required',
      });
    }
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
