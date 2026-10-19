import type { AuthController } from '../auth/auth-controller';
import type { ProgressClient } from '../api/progress-client';
import { progressData, progressId, type ProgressData } from './contracts';
export type ProgressState = {
  status: 'loading' | 'ready' | 'error';
  data: ProgressData | null;
};
export function createProgressController(
  client: ProgressClient,
  auth: Pick<AuthController, 'runAuthenticatedRead'>,
  accountId: string,
  conceptId: string,
) {
  let state: ProgressState = { status: 'loading', data: null },
    generation = 0,
    abort: AbortController | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: ProgressState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  async function load() {
    abort?.abort();
    const request = new AbortController();
    abort = request;
    const version = ++generation;
    emit({ status: 'loading', data: null });
    try {
      if (!progressId.safeParse(conceptId).success)
        throw Error('Invalid Concept');
      const raw = await auth.runAuthenticatedRead(
        accountId,
        request.signal,
        (token, signal) => client.load(conceptId, token, signal),
      );
      if (version !== generation || request.signal.aborted) return;
      const data = progressData.parse(raw);
      if (data.conceptId !== conceptId) throw Error('Invalid identity');
      emit({ status: 'ready', data });
    } catch {
      if (version !== generation || request.signal.aborted) return;
      emit({ status: 'error', data: null });
    }
  }
  return {
    load,
    retry: load,
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    cancel() {
      generation++;
      abort?.abort();
      abort = undefined;
      emit({ status: 'loading', data: null });
    },
  };
}
export type ProgressController = ReturnType<typeof createProgressController>;
