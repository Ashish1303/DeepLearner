import { z } from 'zod';
import { ApiError, type ErrorCode } from './client';
import { envelope } from './contracts';
import { errorEnvelope } from '../learning-paths/contracts';
import {
  command,
  completionId,
  completionView,
  completionIssue,
  completionResponse,
  type CompletionCommand,
} from '../progress/completion-contracts';

const reasons = [
  'COMPLETION_INELIGIBLE',
  'COMPLETION_VIEW_CHANGED',
  'COMPLETION_IDEMPOTENCY_CONFLICT',
  'COMPLETION_RECEIPT_UNAVAILABLE',
  'COMPLETION_COMMIT_UNCONFIRMED',
] as const;
export class CompletionError extends ApiError {
  constructor(
    public readonly reason: (typeof reasons)[number],
    status: number,
  ) {
    super('REQUEST_FAILED', status);
  }
}
export function createCompletionClient(
  base: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
) {
  if (!URL.canParse(base)) throw new ApiError('REQUEST_FAILED');
  const u = new URL(base);
  if (
    !['http:', 'https:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw new ApiError('REQUEST_FAILED');
  const root = base.replace(/\/$/, '');
  async function request<T extends z.ZodType>(
    concept: string,
    token: string,
    external: AbortSignal,
    schema: T,
    cmd?: CompletionCommand,
  ): Promise<z.output<T>> {
    if (!completionId.safeParse(concept).success)
      throw new ApiError('VALIDATION_ERROR', 400);
    const validated = cmd && command.parse(cmd);
    const abort = new AbortController(),
      cancel = () => abort.abort();
    external.addEventListener('abort', cancel, { once: true });
    if (external.aborted) cancel();
    const timer = setTimeout(cancel, timeoutMs);
    try {
      abort.signal.throwIfAborted();
      const response = await fetcher(
        root +
          '/progress/completion' +
          (validated
            ? '/' + concept + '/' + validated.action
            : '?conceptId=' + concept),
        {
          method: validated ? 'POST' : 'GET',
          headers: {
            Authorization: 'Bearer ' + token,
            ...(validated
              ? {
                  'Content-Type': 'application/json',
                  'Idempotency-Key': validated.key,
                }
              : {}),
          },
          ...(validated ? { body: JSON.stringify(validated.body) } : {}),
          signal: abort.signal,
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
        },
      );
      const raw: unknown = await response.json().catch(() => undefined);
      abort.signal.throwIfAborted();
      if (!response.ok) {
        const error = errorEnvelope.safeParse(raw);
        if (!error.success) throw new ApiError('INVALID_RESPONSE');
        const code = error.data.error.code;
        if (reasons.includes(code as (typeof reasons)[number]))
          throw new CompletionError(
            code as (typeof reasons)[number],
            response.status,
          );
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
          allowed.includes(code as ErrorCode)
            ? (code as ErrorCode)
            : 'REQUEST_FAILED',
          response.status,
        );
      }
      if (response.status !== 200) throw new ApiError('INVALID_RESPONSE');
      const parsed = envelope(z.unknown()).safeParse(raw);
      if (!parsed.success) throw new ApiError('INVALID_RESPONSE');
      const data = schema.safeParse(parsed.data.data);
      if (!data.success) throw new ApiError('INVALID_RESPONSE');
      return data.data;
    } catch (error) {
      external.throwIfAborted();
      if (error instanceof ApiError) throw error;
      throw new ApiError('NETWORK_ERROR');
    } finally {
      clearTimeout(timer);
      external.removeEventListener('abort', cancel);
    }
  }
  return {
    async load(concept: string, token: string, signal: AbortSignal) {
      const data = await request(concept, token, signal, completionView);
      if (data.conceptId !== concept) throw new ApiError('INVALID_RESPONSE');
      return data;
    },
    async send(
      concept: string,
      token: string,
      signal: AbortSignal,
      cmd: CompletionCommand,
    ) {
      if (cmd.action === 'complete') {
        const data = await request(concept, token, signal, completionView, cmd);
        if (
          data.conceptId !== concept ||
          data.completion.status !== 'COMPLETED'
        )
          throw new ApiError('INVALID_RESPONSE');
        return data;
      }
      if (cmd.action === 'challenges') {
        const data = await request(
          concept,
          token,
          signal,
          completionIssue,
          cmd,
        );
        if (
          data.challenge.conceptId !== concept ||
          data.section !== cmd.body.section
        )
          throw new ApiError('INVALID_RESPONSE');
        return data;
      }
      const data = await request(
        concept,
        token,
        signal,
        completionResponse,
        cmd,
      );
      if (data.receipt.conceptId !== concept)
        throw new ApiError('INVALID_RESPONSE');
      return data;
    },
  };
}
export type CompletionClient = ReturnType<typeof createCompletionClient>;
