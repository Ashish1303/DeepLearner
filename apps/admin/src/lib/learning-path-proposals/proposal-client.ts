import { z } from 'zod';
import {
  captureBody,
  operationId,
  proposalDto,
  proposalId,
  recoveryDto,
  type ProposalResult,
  type ProposalWireRequest,
} from './contracts';

const messages = {
  VALIDATION_ERROR:
    'Check the brief fields. Text must be trimmed and single-line.',
  AUTH_REQUIRED: 'Your Admin session is unavailable. Sign in again.',
  FORBIDDEN: 'This account cannot access private proposals.',
  NOT_FOUND: 'The Technology or private proposal is unavailable.',
  CONFLICT:
    'The save conflicts with existing data or the Technology is read-only. Check the save outcome; do not replace its operation.',
  RATE_LIMITED: 'Too many requests. Wait before an explicit retry.',
  UNAVAILABLE: 'The request outcome could not be confirmed.',
  INVALID_RESPONSE: 'The response could not be verified.',
  TIMEOUT: 'The request could not be confirmed in time.',
  CANCELLED: 'The request was cancelled.',
  RECOVERY_REQUIRED:
    'An earlier Save is unconfirmed. Check its outcome before another Save.',
  TECHNOLOGY_RECOVERY_REQUIRED:
    'A Technology change is unconfirmed. Resolve it in Technology Management before creating a private proposal.',
  CONTEXT_LOST:
    'Recovery context was lost. Do not repeat the intent; separately approved operator reconciliation is required.',
} as const;
export class ProposalError extends Error {
  constructor(
    readonly code: keyof typeof messages,
    readonly status = 0,
    readonly definitive = false,
  ) {
    super(messages[code]);
    this.name = 'ProposalError';
  }
}
const invalid = () => new ProposalError('INVALID_RESPONSE');
const meta = z.strictObject({ requestId: z.string().min(1).max(128) });
const envelope = z.strictObject({
  success: z.literal(true),
  data: proposalDto,
  message: z.null(),
  meta,
});
const recovery = envelope.extend({ data: recoveryDto });
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
const codes: Record<string, [number, keyof typeof messages]> = {
  VALIDATION_ERROR: [400, 'VALIDATION_ERROR'],
  PAYLOAD_TOO_LARGE: [413, 'VALIDATION_ERROR'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'VALIDATION_ERROR'],
  TECHNOLOGY_NOT_FOUND: [404, 'NOT_FOUND'],
  PROPOSAL_NOT_FOUND: [404, 'NOT_FOUND'],
  TECHNOLOGY_READ_ONLY: [409, 'CONFLICT'],
  PROPOSAL_CONFLICT: [409, 'CONFLICT'],
  RATE_LIMIT_EXCEEDED: [429, 'RATE_LIMITED'],
  DEPENDENCY_UNAVAILABLE: [503, 'UNAVAILABLE'],
  PROPOSAL_OUTCOME_UNKNOWN: [503, 'UNAVAILABLE'],
};
/** Internal transport only. UI receives neither this executor nor the token. */
export function createProposalClient(
  base: string,
  fetcher: typeof fetch = fetch,
  clock: () => number = () => performance.now(),
) {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ProposalError('UNAVAILABLE');
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
    throw new ProposalError('UNAVAILABLE');
  const root = url.origin + '/api/v1/admin/learning-path-proposals';
  return {
    async execute(
      request: ProposalWireRequest,
      token: string,
      external: AbortSignal,
      budget?: { remaining: () => number; dispatched: () => void },
    ): Promise<ProposalResult> {
      let path = '',
        body: string | undefined;
      if (request.kind === 'capture') {
        const parsed = captureBody.safeParse(request.input);
        if (!parsed.success)
          throw new ProposalError('VALIDATION_ERROR', 400, true);
        body = JSON.stringify(parsed.data);
        if (new TextEncoder().encode(body).byteLength > 131072)
          throw new ProposalError('VALIDATION_ERROR', 400, true);
      } else {
        if (!proposalId.safeParse(request.technologyId).success)
          throw new ProposalError('VALIDATION_ERROR', 400, true);
        if (request.kind === 'recover') {
          if (!operationId.safeParse(request.operationId).success)
            throw new ProposalError('VALIDATION_ERROR', 400, true);
          path = '/operations/' + request.operationId;
        } else {
          if (!proposalId.safeParse(request.id).success)
            throw new ProposalError('VALIDATION_ERROR', 400, true);
          path = '/' + request.id;
        }
        path += '?technologyId=' + request.technologyId;
      }
      if (!/^[A-Za-z0-9_.-]{1,8192}(?![\s\S])/.test(token))
        throw new ProposalError('AUTH_REQUIRED', 401);
      const abort = new AbortController(),
        start = clock();
      let timedOut = false;
      const remaining = () =>
        budget ? budget.remaining() : 15000 - (clock() - start);
      const cancel = () => abort.abort();
      const check = () => {
        const left = remaining();
        if (!Number.isFinite(left) || left <= 0 || left > 15000) {
          timedOut = true;
          abort.abort();
        }
        if (abort.signal.aborted)
          throw new ProposalError(timedOut ? 'TIMEOUT' : 'CANCELLED');
      };
      const timer = setTimeout(
        () => {
          timedOut = true;
          abort.abort();
        },
        Math.max(0, Math.min(15000, remaining())),
      );
      external.addEventListener('abort', cancel, { once: true });
      if (external.aborted) cancel();
      let rejectAbort = () => {};
      const lost = new Promise<never>((_, reject) => {
        rejectAbort = () =>
          reject(new ProposalError(timedOut ? 'TIMEOUT' : 'CANCELLED'));
        abort.signal.addEventListener('abort', rejectAbort, { once: true });
        if (abort.signal.aborted) rejectAbort();
      });
      void lost.catch(() => {});
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        check();
        if (request.kind === 'capture') budget?.dispatched();
        const response = await Promise.race([
          fetcher(root + path, {
            method: body ? 'POST' : 'GET',
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: abort.signal,
            headers: {
              Authorization: 'Bearer ' + token,
              ...(body ? { 'Content-Type': 'application/json' } : {}),
            },
            ...(body ? { body } : {}),
          }),
          lost,
        ]);
        check();
        if (response.status === 401 || response.status === 403)
          throw new ProposalError(
            response.status === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN',
            response.status,
          );
        if (
          response.redirected ||
          (response.url && response.url !== root + path) ||
          !/^application\/json(?:\s*;|$)/i.test(
            response.headers.get('content-type') ?? '',
          ) ||
          !/(?:^|,)\s*no-store\s*(?:,|$)/i.test(
            response.headers.get('cache-control') ?? '',
          ) ||
          !response.body
        )
          throw invalid();
        const length = response.headers.get('content-length');
        if (
          length !== null &&
          (!/^\d+$/.test(length) || Number(length) > 131072)
        )
          throw invalid();
        reader = response.body.getReader();
        const bytes = new Uint8Array(131072);
        let total = 0;
        while (true) {
          const chunk = await Promise.race([reader.read(), lost]);
          check();
          if (chunk.done) break;
          if (total + chunk.value.byteLength > bytes.length) throw invalid();
          bytes.set(chunk.value, total);
          total += chunk.value.byteLength;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(
            new TextDecoder('utf-8', { fatal: true }).decode(
              bytes.subarray(0, total),
            ),
          );
        } catch {
          throw invalid();
        }
        check();
        if (response.status !== 200) {
          const parsed = errorEnvelope.safeParse(raw);
          if (!parsed.success) throw invalid();
          const known = codes[parsed.data.error.code];
          if (!known || known[0] !== response.status) throw invalid();
          throw new ProposalError(
            known[1],
            response.status,
            [400, 404, 413, 415, 429].includes(response.status),
          );
        }
        const parsed = (
          request.kind === 'recover' ? recovery : envelope
        ).safeParse(raw);
        if (!parsed.success) throw invalid();
        const value = parsed.data.data;
        const dto =
          'state' in value
            ? value.state === 'COMMITTED'
              ? value.proposal
              : null
            : value;
        const parent =
          request.kind === 'capture'
            ? request.input.technologyId
            : request.technologyId;
        if (
          dto &&
          (dto.technologyId !== parent ||
            (request.kind === 'detail'
              ? dto.id !== request.id
              : dto.revision !== 1))
        )
          throw invalid();
        check();
        return value;
      } catch (error) {
        check();
        if (error instanceof ProposalError) throw error;
        throw new ProposalError('UNAVAILABLE');
      } finally {
        clearTimeout(timer);
        external.removeEventListener('abort', cancel);
        abort.signal.removeEventListener('abort', rejectAbort);
        abort.abort();
        token = '';
        body = undefined;
        if (reader) void reader.cancel().catch(() => {});
      }
    },
  };
}
export type ProposalClient = ReturnType<typeof createProposalClient>;
