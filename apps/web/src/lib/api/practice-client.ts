import { ApiError, type ErrorCode } from './client';
import { errorEnvelope } from '../learning-paths/contracts';
import {
  practiceEnvelope,
  practiceId,
  type PracticePage,
} from '../practice/contracts';
export function createPracticeClient(
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
  return {
    async load(
      conceptId: string,
      page: number,
      token: string,
      external: AbortSignal,
    ): Promise<PracticePage> {
      if (
        !practiceId.safeParse(conceptId).success ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger((page - 1) * 10)
      )
        throw new ApiError('VALIDATION_ERROR', 400);
      const abort = new AbortController();
      const cancel = () => abort.abort();
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      const timer = setTimeout(cancel, timeoutMs);
      try {
        abort.signal.throwIfAborted();
        const response = await fetcher(
          `${root}/practice-questions?conceptId=${conceptId}&page=${page}&limit=10`,
          {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const raw: unknown = await response.json().catch(() => undefined);
        abort.signal.throwIfAborted();
        if (!response.ok) {
          const parsed = errorEnvelope.safeParse(raw);
          if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
          const allowed: ErrorCode[] = [
            'AUTH_ACCESS_TOKEN_MISSING',
            'AUTH_ACCESS_TOKEN_INVALID',
            'AUTH_ACCESS_TOKEN_EXPIRED',
            'AUTH_ACCOUNT_DISABLED',
            'AUTH_ACCOUNT_SUSPENDED',
            'AUTH_EMAIL_NOT_VERIFIED',
            'USER_NOT_FOUND',
            'RATE_LIMIT_EXCEEDED',
            'DEPENDENCY_UNAVAILABLE',
            'ORIGIN_NOT_ALLOWED',
            'VALIDATION_ERROR',
          ];
          const code = parsed.data.error.code;
          throw new ApiError(
            allowed.includes(code as ErrorCode)
              ? (code as ErrorCode)
              : 'REQUEST_FAILED',
            response.status,
          );
        }
        const parsed = practiceEnvelope.safeParse(raw);
        if (
          response.status !== 200 ||
          !parsed.success ||
          parsed.data.meta.page !== page ||
          parsed.data.meta.limit !== 10 ||
          parsed.data.data.some((item) => item.conceptId !== conceptId)
        )
          throw new ApiError('INVALID_RESPONSE');
        return parsed.data;
      } catch (error) {
        external.throwIfAborted();
        if (error instanceof ApiError) throw error;
        throw new ApiError('NETWORK_ERROR');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
      }
    },
  };
}
export type PracticeClient = ReturnType<typeof createPracticeClient>;
