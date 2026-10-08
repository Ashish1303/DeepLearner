import { z } from 'zod';
import {
  accessSchema,
  currentUserSchema,
  envelope,
  logoutSchema,
  type OnboardingProfile,
} from './contracts';
import { profilePayload } from '../onboarding/profile';

const messages = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_EMAIL_NOT_VERIFIED: 'Verify your email before signing in.',
  AUTH_ACCOUNT_DISABLED: 'This account is disabled.',
  AUTH_ACCOUNT_SUSPENDED: 'This account is suspended.',
  AUTH_ACCESS_TOKEN_MISSING: 'Please sign in again.',
  AUTH_ACCESS_TOKEN_INVALID: 'Please sign in again.',
  AUTH_ACCESS_TOKEN_EXPIRED: 'Please sign in again.',
  AUTH_REFRESH_TOKEN_MISSING: 'Please sign in again.',
  AUTH_REFRESH_TOKEN_INVALID: 'Please sign in again.',
  AUTH_REFRESH_TOKEN_EXPIRED: 'Please sign in again.',
  AUTH_REFRESH_TOKEN_REUSED: 'Your session ended. Please sign in again.',
  USER_NOT_FOUND: 'Your account is unavailable. Please sign in again.',
  ORIGIN_NOT_ALLOWED:
    'This site is not permitted to connect. Check the approved application address.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
  DEPENDENCY_UNAVAILABLE:
    'The service is temporarily unavailable. Please try again later.',
  VALIDATION_ERROR: 'Check the supplied details.',
  NETWORK_ERROR: 'The request could not be confirmed. Check your connection.',
  INVALID_RESPONSE: 'The service returned an unexpected response.',
  REQUEST_FAILED: 'The request could not be completed.',
} as const;
export type ErrorCode = keyof typeof messages;
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status = 0,
  ) {
    super(messages[code]);
    this.name = 'ApiError';
  }
}
export function createApiClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  if (!URL.canParse(base)) throw new ApiError('REQUEST_FAILED');
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new ApiError('REQUEST_FAILED');
  const root = base.replace(/\/$/, '');
  async function request<T extends z.ZodType>(
    path: string,
    schema: T,
    init: RequestInit,
  ): Promise<z.output<T>> {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const response = await fetcher(root + path, {
        ...init,
        signal: abort.signal,
        cache: 'no-store',
        redirect: 'error',
      });
      const raw: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const failure = z
          .object({ error: z.object({ code: z.string() }) })
          .safeParse(raw);
        const code = failure.success ? failure.data.error.code : '';
        throw new ApiError(
          Object.hasOwn(messages, code)
            ? (code as ErrorCode)
            : 'REQUEST_FAILED',
          response.status,
        );
      }
      const parsed = envelope(z.unknown()).safeParse(raw);
      if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
      const data = schema.safeParse(parsed.data.data);
      if (!data.success) throw new ApiError('INVALID_RESPONSE');
      return data.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    patchProfile: (token: string, profile: OnboardingProfile) =>
      request('/users/me', currentUserSchema, {
        method: 'PATCH',
        credentials: 'omit',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profilePayload(profile)),
      }),
    login: (email: string, password: string) =>
      request('/auth/login', accessSchema, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    refresh: () =>
      request('/auth/refresh', accessSchema, {
        method: 'POST',
        credentials: 'include',
      }),
    logout: () =>
      request('/auth/logout', logoutSchema, {
        method: 'POST',
        credentials: 'include',
      }),
    me: (token: string) =>
      request('/users/me', currentUserSchema, {
        method: 'GET',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${token}` },
      }),
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
