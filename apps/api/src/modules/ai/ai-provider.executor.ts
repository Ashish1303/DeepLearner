import { types } from 'node:util';
import { Buffer } from 'node:buffer';
import type {
  AiProvider,
  AiProviderErrorCode,
  AiProviderExecutionOptions,
  AiProviderOutcome,
  AiProviderRequest,
  AiProviderUsage,
} from './ai-provider.contract.js';

const maximumBytes = 65_536;
const safeMessage = 'AI provider request could not be completed' as const;

/** Exact, inert own data only; never invoke payload accessors or coercion. */
function record(input: unknown, keys: readonly string[]) {
  if (input === null || typeof input !== 'object' || types.isProxy(input))
    throw new Error();
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) throw new Error();
  const ownKeys = Reflect.ownKeys(input);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== 'string' || !keys.includes(key))
  )
    throw new Error();
  return Object.fromEntries(
    keys.map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor))
        throw new Error();
      return [key, descriptor.value];
    }),
  ) as Record<string, unknown>;
}

function integer(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function text(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  if (typeof value !== 'string' || value.length > maximum) return false;
  // ES2022-compatible well-formed UTF-16 check before byte measurement/JSON.parse.
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  return bytes >= minimum && bytes <= maximum;
}

function instructionText(value: unknown): value is string {
  if (!text(value, 1, 8192) || value.trim().length === 0) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if ((code < 32 && code !== 9 && code !== 10) || code === 127) return false;
  }
  return true;
}

function objectJson(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    );
  } catch {
    return false;
  }
}

function requestData(input: unknown): Readonly<AiProviderRequest> {
  const row = record(input, [
    'schemaVersion',
    'purpose',
    'instructions',
    'inputJson',
    'maxOutputBytes',
    'maxOutputTokens',
  ]);
  if (
    row.schemaVersion !== 1 ||
    row.purpose !== 'CURRICULUM_OUTLINE' ||
    !instructionText(row.instructions) ||
    !text(row.inputJson, 2, maximumBytes) ||
    !objectJson(row.inputJson) ||
    !integer(row.maxOutputBytes, 2, maximumBytes) ||
    !integer(row.maxOutputTokens, 1, 4096)
  )
    throw new Error();
  return Object.freeze({
    schemaVersion: 1,
    purpose: 'CURRICULUM_OUTLINE',
    instructions: row.instructions,
    inputJson: row.inputJson,
    maxOutputBytes: row.maxOutputBytes,
    maxOutputTokens: row.maxOutputTokens,
  });
}

type ResponseData =
  | { ok: true; text: string; usage: AiProviderUsage }
  | { ok: false; code: AiProviderErrorCode };

function responseData(
  input: unknown,
  request: Readonly<AiProviderRequest>,
): ResponseData {
  try {
    const row = record(input, ['text', 'finishReason', 'usage']);
    const usage = record(row.usage, ['inputTokens', 'outputTokens']);
    if (
      typeof row.text !== 'string' ||
      !['COMPLETE', 'OUTPUT_LIMIT', 'REFUSED'].includes(
        row.finishReason as string,
      ) ||
      ![usage.inputTokens, usage.outputTokens].every(
        (value) => value === null || integer(value, 0, Number.MAX_SAFE_INTEGER),
      )
    )
      throw new Error();
    if (!text(row.text, 0, maximumBytes)) throw new Error();
    if (
      Buffer.byteLength(row.text, 'utf8') > request.maxOutputBytes ||
      (typeof usage.outputTokens === 'number' &&
        usage.outputTokens > request.maxOutputTokens) ||
      row.finishReason === 'OUTPUT_LIMIT'
    )
      return { ok: false, code: 'OUTPUT_LIMIT' };
    if (row.finishReason === 'REFUSED') return { ok: false, code: 'REFUSED' };
    if (!objectJson(row.text)) throw new Error();
    return {
      ok: true,
      text: row.text,
      usage: {
        inputTokens: usage.inputTokens as number | null,
        outputTokens: usage.outputTokens as number | null,
      },
    };
  } catch {
    return { ok: false, code: 'MALFORMED_RESPONSE' };
  }
}

/** One injected port, no retries/registration. JSON remains untrusted domain input. */
export function createAiProviderExecutor(
  provider: AiProvider,
  { now = () => performance.now() }: { now?: () => number } = {},
) {
  async function execute(
    input: unknown,
    options: AiProviderExecutionOptions,
  ): Promise<AiProviderOutcome> {
    let invocation: 'NOT_STARTED' | 'STARTED' = 'NOT_STARTED';
    let terminal: AiProviderErrorCode | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let external: AbortSignal | undefined;
    let child: AbortController | undefined;
    let listening = false;
    let started = 0;
    let last = 0;
    let elapsed = 0;
    let budget = 0;
    let wake: () => void = () => {};
    const failure = (code: AiProviderErrorCode): AiProviderOutcome => ({
      ok: false,
      error: { code, message: safeMessage, invocation },
    });
    const lose = (code: AiProviderErrorCode) => {
      if (terminal) return;
      terminal = code;
      wake();
      child?.abort();
    };
    const cancelled = () => lose('CANCELLED');
    const check = () => {
      if (terminal) return terminal;
      if (external?.aborted) lose('CANCELLED');
      else {
        try {
          const current = now();
          if (!Number.isFinite(current) || current < 0 || current < last)
            lose('PROVIDER_FAILED');
          else {
            last = current;
            elapsed = current - started;
            if (elapsed >= budget) lose('DEADLINE_EXCEEDED');
          }
        } catch {
          lose('PROVIDER_FAILED');
        }
      }
      return terminal;
    };

    async function run(): Promise<AiProviderOutcome> {
      let request: Readonly<AiProviderRequest>;
      try {
        const requestedBudget = options.budgetMs;
        if (!integer(requestedBudget, 1, 10_000)) throw new Error();
        budget = requestedBudget;
        external = options.signal;
      } catch {
        return failure('INVALID_REQUEST');
      }
      try {
        // All validation is inside the local execution budget.
        started = now();
        if (!Number.isFinite(started) || started < 0)
          return failure('PROVIDER_FAILED');
        last = started;
      } catch {
        return failure('PROVIDER_FAILED');
      }
      try {
        request = requestData(input);
      } catch {
        return failure('INVALID_REQUEST');
      }
      if (check()) return failure(terminal!);

      child = new AbortController();
      const loss = new Promise<{ kind: 'loss' }>((resolve) => {
        wake = () => resolve({ kind: 'loss' });
      });
      external?.addEventListener('abort', cancelled, { once: true });
      listening = external !== undefined;
      if (check()) return failure(terminal!);
      timer = setTimeout(() => {
        lose(external?.aborted ? 'CANCELLED' : 'DEADLINE_EXCEEDED');
      }, budget - elapsed);
      const signal = child.signal;
      const pending = Promise.resolve()
        .then(() => {
          // Allow queued cancellation to refuse dispatch, not merely hide its result.
          if (check()) return undefined;
          invocation = 'STARTED';
          return provider.generate(request, { signal });
        })
        .then(
          (value) => ({ kind: 'response' as const, value }),
          () => ({ kind: 'rejected' as const }),
        );
      // The rejection observer remains attached after cancellation/deadline wins.
      const settled = await Promise.race([pending, loss]);
      if (check()) return failure(terminal!);
      if (settled.kind !== 'response') return failure('PROVIDER_FAILED');
      const response = responseData(settled.value, request);
      if (check()) return failure(terminal!);
      if (!response.ok) return failure(response.code);
      return {
        ok: true,
        untrustedJson: response.text,
        usage: response.usage,
        elapsedMs: elapsed,
      };
    }

    let outcome: AiProviderOutcome;
    try {
      outcome = await run();
      if (outcome.ok && check()) outcome = failure(terminal!);
    } catch {
      outcome = failure(terminal ?? 'PROVIDER_FAILED');
    } finally {
      try {
        if (timer !== undefined) clearTimeout(timer);
      } catch {
        terminal ??= 'PROVIDER_FAILED';
      }
      try {
        if (listening) external?.removeEventListener('abort', cancelled);
      } catch {
        terminal ??= 'PROVIDER_FAILED';
      }
      if (terminal) {
        try {
          child?.abort();
        } catch {
          terminal = 'PROVIDER_FAILED';
        }
      }
    }
    if (terminal) return failure(terminal);
    return outcome;
  }
  return { execute };
}
