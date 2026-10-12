import { ConceptError, type ConceptClient } from '../api/concept-client';
import { pageNumber } from '../learning-paths/contracts';
import type { ConceptData, ConceptResource } from './contracts';
export interface ConceptState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  data: ConceptData | null;
  message: string;
  invalidRequest: boolean;
  focusRevision: number;
}
export function createConceptController(
  client: ConceptClient,
  resource: ConceptResource,
  id: string,
) {
  let state: ConceptState = {
    status: 'idle',
    page: 1,
    data: null,
    message: '',
    invalidRequest: false,
    focusRevision: 0,
  };
  let generation = 0;
  let active: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: ConceptState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function load(page = 1, explicit = false) {
    if (
      !pageNumber.safeParse(page).success ||
      (resource === 'concept' && page !== 1)
    )
      return;
    const current = ++generation;
    active?.abort();
    const request = new AbortController();
    active = request;
    const focusRevision = state.focusRevision + (explicit ? 1 : 0);
    publish({
      ...state,
      status: 'loading',
      page,
      data: null,
      message: '',
      invalidRequest: false,
    });
    try {
      const data = await client.load(resource, id, page, request.signal);
      if (current !== generation || request.signal.aborted) return;
      publish({ ...state, status: 'ready', data, focusRevision });
    } catch (error) {
      if (current !== generation || request.signal.aborted) return;
      const safe =
        error instanceof ConceptError ? error : new ConceptError('network');
      publish({
        ...state,
        status: 'error',
        message: safe.message,
        invalidRequest: safe.kind === 'invalid',
        focusRevision,
      });
    } finally {
      if (current === generation) active = undefined;
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    retry: () => load(state.page, true),
    cancel() {
      ++generation;
      active?.abort();
      active = undefined;
      publish({
        ...state,
        status: 'idle',
        data: null,
        message: '',
        invalidRequest: false,
      });
    },
  };
}
