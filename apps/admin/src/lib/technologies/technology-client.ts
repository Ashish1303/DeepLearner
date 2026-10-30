import { z } from 'zod';
import {
  technologyDto,
  technologyRequest,
  pagination,
  validateTechnologyPage,
  type TechnologyRequest,
  type TechnologyResult,
} from './contracts';

const messages = {
  VALIDATION_ERROR: 'Check the highlighted Technology fields.',
  AUTH_REQUIRED: 'Your Admin session is unavailable. Sign in again.',
  FORBIDDEN: 'This account cannot manage Technologies.',
  NOT_FOUND: 'This Technology is unavailable.',
  CONFLICT:
    'The Technology changed or its slug is already reserved. Reload before making another change.',
  RATE_LIMITED: 'Too many requests. Wait before trying again.',
  UNAVAILABLE: 'Technology management is temporarily unavailable.',
  INVALID_RESPONSE: 'The response could not be verified.',
  NETWORK_ERROR: 'The request could not be confirmed.',
  TIMEOUT: 'The request could not be confirmed in time.',
  CANCELLED: 'The request was cancelled.',
} as const;
export type TechnologyErrorCode = keyof typeof messages;
export class TechnologyError extends Error {
  constructor(
    readonly code: TechnologyErrorCode,
    readonly status = 0,
  ) {
    super(messages[code]);
    this.name = 'TechnologyError';
  }
}
const fail = () => new TechnologyError('INVALID_RESPONSE');
const meta = z.strictObject({ requestId: z.string().min(1).max(128) });
const itemEnvelope = z.strictObject({
  success: z.literal(true),
  data: technologyDto,
  message: z.null(),
  meta,
});
const listEnvelope = z.strictObject({
  success: z.literal(true),
  data: z.array(technologyDto).max(100),
  message: z.null(),
  meta: meta.extend(pagination.shape),
});
const errorEnvelope = z.strictObject({
  success: z.literal(false),
  error: z.strictObject({
    code: z.string().min(1).max(128),
    message: z.string().max(4096),
    details: z
      .array(
        z.strictObject({
          field: z.string().max(256),
          message: z.string().max(4096),
        }),
      )
      .max(64)
      .optional(),
  }),
  meta,
});
const codes: Record<string, [number, TechnologyErrorCode]> = {
  PAYLOAD_TOO_LARGE: [413, 'VALIDATION_ERROR'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'VALIDATION_ERROR'],
  VALIDATION_ERROR: [400, 'VALIDATION_ERROR'],
  AUTH_ACCESS_TOKEN_MISSING: [401, 'AUTH_REQUIRED'],
  AUTH_ACCESS_TOKEN_INVALID: [401, 'AUTH_REQUIRED'],
  AUTH_ACCESS_TOKEN_EXPIRED: [401, 'AUTH_REQUIRED'],
  AUTH_FORBIDDEN: [403, 'FORBIDDEN'],
  ORIGIN_NOT_ALLOWED: [403, 'FORBIDDEN'],
  TECHNOLOGY_NOT_FOUND: [404, 'NOT_FOUND'],
  ROUTE_NOT_FOUND: [404, 'NOT_FOUND'],
  TECHNOLOGY_SLUG_CONFLICT: [409, 'CONFLICT'],
  TECHNOLOGY_REVISION_CONFLICT: [409, 'CONFLICT'],
  TECHNOLOGY_READ_ONLY: [409, 'CONFLICT'],
  RATE_LIMIT_EXCEEDED: [429, 'RATE_LIMITED'],
  DEPENDENCY_UNAVAILABLE: [503, 'UNAVAILABLE'],
  INTERNAL_ERROR: [500, 'UNAVAILABLE'],
};
export function createTechnologyClient(
  base: string,
  fetcher: typeof fetch = fetch,
  clock: () => number = () => performance.now(),
) {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new TechnologyError('UNAVAILABLE');
  }
  const local =
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
    ['http:', 'https:'].includes(url.protocol) &&
    url.port === '4000';
  if (
    (!local && url.origin !== 'https://api.deeplearner.com') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['/api/v1', '/api/v1/'].includes(url.pathname)
  )
    throw new TechnologyError('UNAVAILABLE');
  const root = url.origin + '/api/v1/admin/technologies';
  return {
    async execute(
      raw: TechnologyRequest,
      token: string,
      external: AbortSignal,
    ): Promise<TechnologyResult> {
      const parsed = technologyRequest.safeParse(raw);
      if (!parsed.success) throw new TechnologyError('VALIDATION_ERROR', 400);
      if (!/^[A-Za-z0-9_.-]{1,8192}(?![\s\S])/.test(token))
        throw new TechnologyError('AUTH_REQUIRED', 401);
      const request = parsed.data;
      const path =
        request.kind === 'list'
          ? `?page=${request.query.page}&limit=${request.query.limit}`
          : request.kind === 'create'
            ? ''
            : '/' + request.id;
      const mutation = request.kind === 'create' || request.kind === 'patch';
      const method =
        request.kind === 'create'
          ? 'POST'
          : request.kind === 'patch'
            ? 'PATCH'
            : 'GET';
      const requestBody = mutation ? JSON.stringify(request.input) : undefined;
      if (
        requestBody &&
        new TextEncoder().encode(requestBody).byteLength > 4096
      )
        throw new TechnologyError('VALIDATION_ERROR', 400);
      const abort = new AbortController(),
        start = clock();
      let timedOut = false;
      const cancel = () => abort.abort();
      const check = () => {
        const elapsed = clock() - start;
        if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 15000) {
          timedOut = true;
          abort.abort();
        }
        if (abort.signal.aborted)
          throw new TechnologyError(
            external.aborted
              ? 'CANCELLED'
              : timedOut
                ? 'TIMEOUT'
                : 'NETWORK_ERROR',
          );
      };
      const timer = setTimeout(() => {
        timedOut = true;
        abort.abort();
      }, 15000);
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      let rejectAbort = () => {};
      const lost = new Promise<never>((_, reject) => {
        rejectAbort = () =>
          reject(
            new TechnologyError(
              external.aborted
                ? 'CANCELLED'
                : timedOut
                  ? 'TIMEOUT'
                  : 'NETWORK_ERROR',
            ),
          );
        abort.signal.addEventListener('abort', rejectAbort, { once: true });
        if (abort.signal.aborted) rejectAbort();
      });
      void lost.catch(() => {});
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        check();
        const response = await Promise.race([
          fetcher(root + path, {
            method,
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
            headers: {
              Authorization: 'Bearer ' + token,
              ...(mutation ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(requestBody ? { body: requestBody } : {}),
          }),
          lost,
        ]);
        check();
        // An explicit authentication refusal removes authority even if its body is corrupt.
        if (response.status === 401 || response.status === 403)
          throw new TechnologyError(
            response.status === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN',
            response.status,
          );
        if (
          response.redirected ||
          (response.url && response.url !== root + path) ||
          !/^application\/json(?:\s*;|$)/i.test(
            response.headers.get('content-type') ?? '',
          ) ||
          !response.body
        )
          throw fail();
        const length = response.headers.get('content-length');
        if (
          length !== null &&
          (!/^\d+$/.test(length) || Number(length) > 1048576)
        )
          throw fail();
        reader = response.body.getReader();
        // Fixed storage also bounds memory for adversarial tiny/empty chunks.
        const bytes = new Uint8Array(1048576);
        let total = 0;
        while (true) {
          const chunk = await Promise.race([reader.read(), lost]);
          check();
          if (chunk.done) break;
          if (total + chunk.value.byteLength > bytes.byteLength) throw fail();
          bytes.set(chunk.value, total);
          total += chunk.value.byteLength;
        }
        let body: unknown;
        try {
          body = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(
              bytes.subarray(0, total),
            ),
          );
        } catch {
          throw fail();
        }
        check();
        if (!response.ok) {
          const e = errorEnvelope.safeParse(body);
          if (!e.success) throw fail();
          const known = codes[e.data.error.code];
          if (!known || known[0] !== response.status) throw fail();
          throw new TechnologyError(known[1], response.status);
        }
        if (response.status !== (request.kind === 'create' ? 201 : 200))
          throw fail();
        if (request.kind === 'list') {
          const e = listEnvelope.safeParse(body);
          if (!e.success) throw fail();
          const { requestId: _, ...page } = e.data.meta;
          void _;
          try {
            return validateTechnologyPage(e.data.data, page, request.query);
          } catch {
            throw fail();
          }
        }
        const e = itemEnvelope.safeParse(body);
        if (!e.success) throw fail();
        if (
          (request.kind === 'detail' || request.kind === 'patch') &&
          e.data.data.id !== request.id
        )
          throw fail();
        if (
          request.kind === 'create' &&
          (e.data.data.status !== 'DRAFT' ||
            e.data.data.revision !== 0 ||
            e.data.data.slug !== request.input.slug)
        )
          throw fail();
        if (
          request.kind === 'patch' &&
          (e.data.data.status !== 'DRAFT' ||
            e.data.data.revision !== request.input.revision + 1)
        )
          throw fail();
        return e.data.data;
      } catch (error) {
        check();
        if (error instanceof TechnologyError) throw error;
        throw new TechnologyError('NETWORK_ERROR');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
        abort.signal.removeEventListener('abort', rejectAbort);
        abort.abort();
        token = '';
        if (reader) void reader.cancel().catch(() => {});
      }
    },
  };
}
export type TechnologyClient = ReturnType<typeof createTechnologyClient>;
