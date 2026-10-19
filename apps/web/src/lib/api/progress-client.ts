import { ApiError, type ErrorCode } from './client';
import { errorEnvelope } from '../learning-paths/contracts';
import { progressEnvelope, progressId } from '../progress/contracts';
export function createProgressClient(
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
    async load(conceptId: string, token: string, external: AbortSignal) {
      if (!progressId.safeParse(conceptId).success)
        throw new ApiError('VALIDATION_ERROR', 400);
      const controller = new AbortController(),
        cancel = () => controller.abort();
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      const timer = setTimeout(cancel, timeoutMs);
      try {
        controller.signal.throwIfAborted();
        const response = await fetcher(
          root + '/progress?conceptId=' + conceptId,
          {
            method: 'GET',
            headers: { Authorization: 'Bearer ' + token },
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error',
          },
        );
        const raw: unknown = await response.json().catch(() => undefined);
        controller.signal.throwIfAborted();
        if (!response.ok) {
          const error = errorEnvelope.safeParse(raw);
          if (!error.success) throw new ApiError('INVALID_RESPONSE');
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
          throw new ApiError(
            allowed.includes(error.data.error.code as ErrorCode)
              ? (error.data.error.code as ErrorCode)
              : 'REQUEST_FAILED',
            response.status,
          );
        }
        if (response.status !== 200) throw new ApiError('INVALID_RESPONSE');
        const result = progressEnvelope.safeParse(raw);
        if (!result.success || result.data.data.conceptId !== conceptId)
          throw new ApiError('INVALID_RESPONSE');
        return result.data.data;
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
export type ProgressClient = ReturnType<typeof createProgressClient>;
