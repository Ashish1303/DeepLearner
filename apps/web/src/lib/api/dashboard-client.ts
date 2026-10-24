import { z } from 'zod';
import { ApiError, type ErrorCode } from './client';
import { errorEnvelope } from '../learning-paths/contracts';
import {
  dashboardCursor,
  dashboardEnvelope,
  parseDashboardPage,
} from '../dashboard/contracts';

export type DashboardFailure =
  'denied' | 'unavailable' | 'rate-limited' | 'error';
export class DashboardError extends ApiError {
  constructor(
    public readonly kind: DashboardFailure,
    code: ErrorCode = 'REQUEST_FAILED',
    status = 0,
  ) {
    super(code, status);
  }
}
const category = (status: number): DashboardFailure =>
  status === 401 || status === 403
    ? 'denied'
    : status === 404 || status === 503
      ? 'unavailable'
      : status === 429
        ? 'rate-limited'
        : 'error';
const allowed: ErrorCode[] = [
  'AUTH_ACCESS_TOKEN_MISSING',
  'AUTH_ACCESS_TOKEN_INVALID',
  'AUTH_ACCESS_TOKEN_EXPIRED',
  'AUTH_ACCOUNT_DISABLED',
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_EMAIL_NOT_VERIFIED',
  'USER_NOT_FOUND',
  'ORIGIN_NOT_ALLOWED',
  'RATE_LIMIT_EXCEEDED',
  'DEPENDENCY_UNAVAILABLE',
  'VALIDATION_ERROR',
];

export function createDashboardClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 35000,
) {
  if (
    !URL.canParse(base) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 35000
  )
    throw new DashboardError('error');
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new DashboardError('error');
  const root = base.replace(/\/$/, '');
  return {
    async load(cursor: string | null, token: string, external: AbortSignal) {
      if (
        !dashboardCursor.safeParse(cursor).success ||
        !z
          .string()
          .min(1)
          .max(4096)
          .regex(/^[^\r\n]+$/)
          .safeParse(token).success
      )
        throw new DashboardError('error', 'VALIDATION_ERROR', 400);
      const abort = new AbortController();
      const cancel = () => abort.abort();
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      const started = performance.now();
      const timer = setTimeout(cancel, timeoutMs);
      const check = () => {
        if (performance.now() - started >= timeoutMs) cancel();
        abort.signal.throwIfAborted();
      };
      try {
        check();
        const response = await fetcher(
          root +
            '/dashboard?limit=5' +
            (cursor === null ? '' : '&cursor=' + cursor),
          {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
          },
        );
        check();
        const raw: unknown = await response.json().catch(() => undefined);
        check();
        if (!response.ok) {
          const failure = errorEnvelope.safeParse(raw);
          const code = failure.success ? failure.data.error.code : '';
          throw new DashboardError(
            category(response.status),
            !failure.success
              ? 'INVALID_RESPONSE'
              : allowed.includes(code as ErrorCode)
                ? (code as ErrorCode)
                : 'REQUEST_FAILED',
            response.status,
          );
        }
        if (response.status !== 200)
          throw new DashboardError('error', 'INVALID_RESPONSE');
        const parsed = dashboardEnvelope.safeParse(raw);
        if (!parsed.success)
          throw new DashboardError('error', 'INVALID_RESPONSE');
        const data = parseDashboardPage(parsed.data.data, cursor);
        check();
        return data;
      } catch (error) {
        external.throwIfAborted();
        if (error instanceof DashboardError) throw error;
        if (
          error instanceof z.ZodError ||
          (error instanceof Error && error.message === 'Invalid dashboard page')
        )
          throw new DashboardError('error', 'INVALID_RESPONSE');
        throw new DashboardError('error', 'NETWORK_ERROR');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
      }
    },
  };
}
export type DashboardClient = ReturnType<typeof createDashboardClient>;
