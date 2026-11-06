import type {
  AiProvider,
  AiProviderRequest,
} from '../../src/modules/ai/ai-provider.contract.js';

/** Explicitly synthetic, test-only port. It never generates production content. */
export type FakeAiProviderScenario =
  | { kind: 'response'; value: unknown }
  | { kind: 'reject'; reason: unknown }
  | { kind: 'deferred' };

export function createFakeAiProvider(scenario: FakeAiProviderScenario) {
  const calls: { request: Readonly<AiProviderRequest>; signal: AbortSignal }[] =
    [];
  let resolve: (value: unknown) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const deferred =
    scenario.kind === 'deferred'
      ? new Promise<unknown>((yes, no) => {
          resolve = yes;
          reject = no;
        })
      : undefined;
  // Tests may settle before dispatch or after cancellation; observe rejection now.
  void deferred?.catch(() => {});
  const provider: AiProvider = {
    generate(request, { signal }) {
      calls.push({ request, signal });
      if (scenario.kind === 'response') return Promise.resolve(scenario.value);
      if (scenario.kind === 'reject') return Promise.reject(scenario.reason);
      return deferred!;
    },
  };
  return { provider, calls, resolve, reject };
}
