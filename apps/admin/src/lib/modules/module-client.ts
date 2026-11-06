import { z } from 'zod';
import {
  moduleDto,
  moduleRequest,
  pagination,
  validateModulePage,
  type ModuleRequest,
  type ModuleResult,
} from './contracts';

const messages = {
  VALIDATION_ERROR: 'Check the highlighted Module request.',
  AUTH_REQUIRED: 'Your Admin session is unavailable. Sign in again.',
  FORBIDDEN: 'This account cannot inspect Modules.',
  PARENT_NOT_FOUND:
    'This Learning Path is unavailable. Select another Learning Path.',
  NOT_FOUND: 'This Module is unavailable.',
  RATE_LIMITED: 'Too many requests. Wait before trying again.',
  UNAVAILABLE: 'Module inspection is temporarily unavailable.',
  INVALID_RESPONSE: 'The response could not be verified.',
  NETWORK_ERROR: 'The request could not be confirmed.',
  TIMEOUT: 'The request could not be confirmed in time.',
  CANCELLED: 'The request was cancelled.',
} as const;
export type ModuleErrorCode = keyof typeof messages;
export class ModuleError extends Error {
  constructor(
    readonly code: ModuleErrorCode,
    readonly status = 0,
  ) {
    super(messages[code]);
    this.name = 'ModuleError';
  }
}
const fail = () => new ModuleError('INVALID_RESPONSE');
const meta = z.strictObject({ requestId: z.string().min(1).max(128) });
const itemEnvelope = z.strictObject({
  success: z.literal(true),
  data: moduleDto,
  message: z.null(),
  meta,
});
const listEnvelope = z.strictObject({
  success: z.literal(true),
  data: z.array(moduleDto).max(100),
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
      .max(20)
      .optional(),
  }),
  meta,
});
const codes: Record<string, [number, ModuleErrorCode]> = {
  PAYLOAD_TOO_LARGE: [413, 'VALIDATION_ERROR'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'VALIDATION_ERROR'],
  VALIDATION_ERROR: [400, 'VALIDATION_ERROR'],
  AUTH_ACCESS_TOKEN_MISSING: [401, 'AUTH_REQUIRED'],
  AUTH_ACCESS_TOKEN_INVALID: [401, 'AUTH_REQUIRED'],
  AUTH_ACCESS_TOKEN_EXPIRED: [401, 'AUTH_REQUIRED'],
  AUTH_FORBIDDEN: [403, 'FORBIDDEN'],
  ORIGIN_NOT_ALLOWED: [403, 'FORBIDDEN'],
  LEARNING_PATH_NOT_FOUND: [404, 'PARENT_NOT_FOUND'],
  MODULE_NOT_FOUND: [404, 'NOT_FOUND'],
  ROUTE_NOT_FOUND: [404, 'NOT_FOUND'],
  RATE_LIMIT_EXCEEDED: [429, 'RATE_LIMITED'],
  DEPENDENCY_UNAVAILABLE: [503, 'UNAVAILABLE'],
  INTERNAL_ERROR: [500, 'UNAVAILABLE'],
};
export function createModuleClient(
  base: string,
  fetcher: typeof fetch = fetch,
  clock: () => number = () => performance.now(),
) {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ModuleError('UNAVAILABLE');
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
    throw new ModuleError('UNAVAILABLE');
  const root = url.origin + '/api/v1/admin/modules';
  return {
    async execute(
      raw: ModuleRequest,
      token: string,
      external: AbortSignal,
    ): Promise<ModuleResult> {
      const parsed = moduleRequest.safeParse(raw);
      if (!parsed.success) throw new ModuleError('VALIDATION_ERROR', 400);
      if (!/^[A-Za-z0-9_.-]{1,8192}(?![\s\S])/.test(token))
        throw new ModuleError('AUTH_REQUIRED', 401);
      const request = parsed.data;
      const path =
        request.kind === 'list'
          ? `?technologyId=${request.query.technologyId}&learningPathId=${request.query.learningPathId}&page=${request.query.page}&limit=${request.query.limit}`
          : '/' +
            request.id +
            '?technologyId=' +
            request.technologyId +
            '&learningPathId=' +
            request.learningPathId;
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
          throw new ModuleError(
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
            new ModuleError(
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
            method: 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
            headers: {
              Authorization: 'Bearer ' + token,
            },
          }),
          lost,
        ]);
        check();
        // An explicit authentication refusal removes authority even if its body is corrupt.
        if (response.status === 401 || response.status === 403)
          throw new ModuleError(
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
          (!/^\d+$/.test(length) || Number(length) > 2097152)
        )
          throw fail();
        reader = response.body.getReader();
        // Fixed storage also bounds memory for adversarial tiny/empty chunks.
        const bytes = new Uint8Array(2097152);
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
          if (
            !e.success ||
            (e.data.error.details !== undefined &&
              e.data.error.code !== 'VALIDATION_ERROR')
          )
            throw fail();
          const known = codes[e.data.error.code];
          if (!known || known[0] !== response.status) throw fail();
          throw new ModuleError(known[1], response.status);
        }
        if (response.status !== 200) throw fail();
        if (request.kind === 'list') {
          const e = listEnvelope.safeParse(body);
          if (!e.success) throw fail();
          const { requestId: _, ...page } = e.data.meta;
          void _;
          try {
            return validateModulePage(
              { items: e.data.data, pagination: page },
              request.query,
            );
          } catch {
            throw fail();
          }
        }
        const e = itemEnvelope.safeParse(body);
        if (!e.success) throw fail();
        if (
          request.kind !== 'detail' ||
          e.data.data.id !== request.id ||
          e.data.data.technologyId !== request.technologyId ||
          e.data.data.learningPathId !== request.learningPathId
        )
          throw fail();
        return e.data.data;
      } catch (error) {
        check();
        if (error instanceof ModuleError) throw error;
        throw new ModuleError('NETWORK_ERROR');
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
export type ModuleClient = ReturnType<typeof createModuleClient>;
