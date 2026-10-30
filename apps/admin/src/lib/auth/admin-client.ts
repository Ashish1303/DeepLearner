import { z } from 'zod';
import {
  currentUserSchema,
  errorEnvelope,
  loginInput,
  loginSchema,
  refreshSchema,
  successEnvelope,
} from './contracts';

const messages = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_EMAIL_NOT_VERIFIED: 'Verify your email before signing in.',
  AUTH_ACCOUNT_DISABLED: 'This account is disabled.',
  AUTH_ACCOUNT_SUSPENDED: 'This account is suspended.',
  AUTH_FORBIDDEN: 'This account cannot access Admin.',
  AUTH_ACCESS_TOKEN_MISSING: 'Sign in again to continue.',
  AUTH_ACCESS_TOKEN_INVALID: 'Sign in again to continue.',
  AUTH_ACCESS_TOKEN_EXPIRED: 'Your session expired. Sign in again.',
  AUTH_REFRESH_TOKEN_MISSING: 'Sign in again to continue.',
  AUTH_REFRESH_TOKEN_INVALID: 'Sign in again to continue.',
  AUTH_REFRESH_TOKEN_EXPIRED: 'Your session expired. Sign in again.',
  AUTH_REFRESH_TOKEN_REUSED: 'Your session ended. Sign in again.',
  USER_NOT_FOUND: 'This account is unavailable.',
  ORIGIN_NOT_ALLOWED: 'This application address is not permitted.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Wait before trying again.',
  DEPENDENCY_UNAVAILABLE: 'The service is temporarily unavailable.',
  ROUTE_NOT_FOUND: 'The requested service is unavailable.',
  VALIDATION_ERROR: 'Check the supplied details.',
  REQUEST_FAILED: 'The request could not be completed.',
  INVALID_RESPONSE: 'The service returned an unexpected response.',
  NETWORK_ERROR: 'The request could not be confirmed.',
  TIMEOUT: 'The request could not be confirmed in time.',
  CANCELLED: 'The request was cancelled.',
} as const;
export type AdminErrorCode = keyof typeof messages;
export class AdminApiError extends Error {
  readonly code: AdminErrorCode;
  readonly status: number;
  constructor(code: AdminErrorCode, status = 0) {
    super(messages[code]);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
  }
}
const expectedStatus: Partial<Record<AdminErrorCode, number>> = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_EMAIL_NOT_VERIFIED: 403,
  AUTH_ACCOUNT_DISABLED: 403,
  AUTH_ACCOUNT_SUSPENDED: 403,
  AUTH_FORBIDDEN: 403,
  AUTH_ACCESS_TOKEN_MISSING: 401,
  AUTH_ACCESS_TOKEN_INVALID: 401,
  AUTH_ACCESS_TOKEN_EXPIRED: 401,
  AUTH_REFRESH_TOKEN_MISSING: 401,
  AUTH_REFRESH_TOKEN_INVALID: 401,
  AUTH_REFRESH_TOKEN_EXPIRED: 401,
  AUTH_REFRESH_TOKEN_REUSED: 401,
  USER_NOT_FOUND: 404,
  ORIGIN_NOT_ALLOWED: 403,
  RATE_LIMIT_EXCEEDED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  ROUTE_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
};
export function createAdminClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  if (
    !URL.canParse(base) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 15000
  )
    throw new AdminApiError('REQUEST_FAILED');
  const url = new URL(base);
  const local =
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    ['http:', 'https:'].includes(url.protocol) &&
    url.port === '4000';
  const hosted = url.origin === 'https://api.deeplearner.com';
  if (
    (!local && !hosted) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/api/v1', '/api/v1/'].includes(url.pathname)
  )
    throw new AdminApiError('REQUEST_FAILED');
  const root = url.origin + '/api/v1';
  async function request<T extends z.ZodType>(
    path: string,
    schema: T,
    init: RequestInit,
    external?: AbortSignal,
  ): Promise<z.output<T>> {
    const abort = new AbortController();
    const started = performance.now();
    let timedOut = false;
    const cancel = () => abort.abort();
    const check = () => {
      if (performance.now() - started >= timeoutMs) {
        timedOut = true;
        abort.abort();
      }
      if (abort.signal.aborted)
        throw new AdminApiError(
          external?.aborted
            ? 'CANCELLED'
            : timedOut
              ? 'TIMEOUT'
              : 'NETWORK_ERROR',
        );
    };
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, timeoutMs);
    external?.addEventListener('abort', cancel, { once: true });
    if (external?.aborted) cancel();
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => {
        try {
          check();
        } catch (error) {
          reject(error);
        }
      };
      abort.signal.addEventListener('abort', rejectAbort, { once: true });
      if (abort.signal.aborted) rejectAbort();
    });
    // Observe rejection even when the initial check refuses before the race.
    void aborted.catch(() => {});
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      check();
      const response = await Promise.race([
        fetcher(root + path, {
          ...init,
          signal: abort.signal,
          cache: 'no-store',
          redirect: 'error',
        }),
        aborted,
      ]);
      check();
      if (
        response.redirected ||
        (response.url && response.url !== root + path) ||
        !response.headers
          .get('content-type')
          ?.toLowerCase()
          .startsWith('application/json')
      )
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      const declared = response.headers.get('content-length');
      if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536))
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      if (!response.body)
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const chunk = await Promise.race([reader.read(), aborted]);
        check();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 65536)
          throw new AdminApiError('INVALID_RESPONSE', response.status);
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      let raw: unknown;
      try {
        raw = JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        );
      } catch {
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      }
      check();
      if (!response.ok) {
        const failure = errorEnvelope.safeParse(raw);
        if (!failure.success)
          throw new AdminApiError('INVALID_RESPONSE', response.status);
        const code = failure.data.error.code;
        const known = Object.hasOwn(expectedStatus, code);
        if (known && expectedStatus[code as AdminErrorCode] !== response.status)
          throw new AdminApiError('INVALID_RESPONSE', response.status);
        throw new AdminApiError(
          known ? (code as AdminErrorCode) : 'REQUEST_FAILED',
          response.status,
        );
      }
      if (response.status !== 200)
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      const parsed = successEnvelope(schema).safeParse(raw);
      if (!parsed.success)
        throw new AdminApiError('INVALID_RESPONSE', response.status);
      check();
      // The strict envelope above validates the generic data member.
      return (parsed.data as { data: z.output<T> }).data;
    } catch (error) {
      check();
      if (error instanceof AdminApiError) throw error;
      throw new AdminApiError('NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      external?.removeEventListener('abort', cancel);
      if (rejectAbort) abort.signal.removeEventListener('abort', rejectAbort);
      // Abort/cancel unconsumed bodies without retaining server data or error detail.
      abort.abort();
      if (reader) void reader.cancel().catch(() => {});
    }
  }
  return {
    login(email: string, password: string, signal?: AbortSignal) {
      const parsed = loginInput.safeParse({ email, password });
      if (!parsed.success)
        return Promise.reject(new AdminApiError('VALIDATION_ERROR', 400));
      return request(
        '/auth/login',
        loginSchema,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        },
        signal,
      );
    },
    refresh: (signal?: AbortSignal) =>
      request(
        '/auth/refresh',
        refreshSchema,
        {
          method: 'POST',
          credentials: 'include',
        },
        signal,
      ),
    logout: (signal?: AbortSignal) =>
      request(
        '/auth/logout',
        z.null(),
        {
          method: 'POST',
          credentials: 'include',
        },
        signal,
      ),
    me(token: string, signal?: AbortSignal) {
      if (!refreshSchema.shape.accessToken.safeParse(token).success)
        return Promise.reject(new AdminApiError('VALIDATION_ERROR', 400));
      return request(
        '/users/me',
        currentUserSchema,
        {
          method: 'GET',
          credentials: 'omit',
          headers: { Authorization: 'Bearer ' + token },
        },
        signal,
      );
    },
  };
}
export type AdminClient = ReturnType<typeof createAdminClient>;
