/** Technical port only: no domain admission, authority or live registration. */
export interface AiProviderRequest {
  schemaVersion: 1;
  purpose: 'CURRICULUM_OUTLINE';
  instructions: string;
  inputJson: string;
  maxOutputBytes: number;
  maxOutputTokens: number;
}

export interface AiProvider {
  generate(
    request: Readonly<AiProviderRequest>,
    context: { signal: AbortSignal },
  ): Promise<unknown>;
}

export interface AiProviderUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export type AiProviderErrorCode =
  | 'INVALID_REQUEST'
  | 'CANCELLED'
  | 'DEADLINE_EXCEEDED'
  | 'PROVIDER_FAILED'
  | 'MALFORMED_RESPONSE'
  | 'OUTPUT_LIMIT'
  | 'REFUSED';

export type AiProviderOutcome =
  | {
      ok: true;
      untrustedJson: string;
      usage: AiProviderUsage;
      elapsedMs: number;
    }
  | {
      ok: false;
      error: {
        code: AiProviderErrorCode;
        message: 'AI provider request could not be completed';
        invocation: 'NOT_STARTED' | 'STARTED';
      };
    };

export interface AiProviderExecutionOptions {
  budgetMs: number;
  signal?: AbortSignal;
}
