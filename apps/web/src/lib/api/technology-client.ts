import { ApiError } from './client';
import {
  catalogPageNumber,
  catalogResponseSchema,
} from '../technologies/contracts';
export function createTechnologyClient(
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
    async list(page: number, signal: AbortSignal) {
      if (!catalogPageNumber.safeParse(page).success)
        throw new ApiError('VALIDATION_ERROR', 400);
      const abort = new AbortController();
      const cancel = () => abort.abort();
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      const timer = setTimeout(cancel, timeoutMs);
      try {
        if (abort.signal.aborted) throw new Error();
        const response = await fetcher(
          root + '/technologies?page=' + page + '&limit=20',
          {
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
          },
        );
        const raw: unknown = await response.json().catch(() => undefined);
        if (abort.signal.aborted) throw new Error();
        if (!response.ok) {
          const codes = {
            400: 'VALIDATION_ERROR',
            403: 'ORIGIN_NOT_ALLOWED',
            429: 'RATE_LIMIT_EXCEEDED',
            503: 'DEPENDENCY_UNAVAILABLE',
          } as const;
          const code =
            codes[response.status as keyof typeof codes] ?? 'REQUEST_FAILED';
          throw new ApiError(code, response.status);
        }
        const result = catalogResponseSchema.safeParse(raw);
        if (!result.success || result.data.meta.page !== page)
          throw new ApiError('INVALID_RESPONSE');
        return result.data;
      } catch (error) {
        if (signal.aborted)
          throw new DOMException('Request cancelled', 'AbortError');
        if (error instanceof ApiError) throw error;
        throw new ApiError('NETWORK_ERROR');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
      }
    },
  };
}
export type TechnologyClient = ReturnType<typeof createTechnologyClient>;
