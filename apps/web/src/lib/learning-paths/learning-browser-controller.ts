import {
  LearningError,
  type LearningPathClient,
} from '../api/learning-path-client';
import { pageNumber, type BrowserData } from './contracts';
import type { Resource } from './routes';
export interface LearningState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  data: BrowserData | null;
  message: string;
  invalidRequest: boolean;
  focusRevision: number;
}
export function createLearningBrowserController(
  client: LearningPathClient,
  resource: Resource,
  id: string,
) {
  let state: LearningState = {
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
  const publish = (next: LearningState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function load(page = 1, explicit = false) {
    if (!pageNumber.safeParse(page).success) return;
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
      if (generation !== current || request.signal.aborted) return;
      publish({ ...state, status: 'ready', data, focusRevision });
    } catch (error) {
      if (generation !== current || request.signal.aborted) return;
      const safe =
        error instanceof LearningError ? error : new LearningError('network');
      publish({
        ...state,
        status: 'error',
        message: safe.message,
        invalidRequest: safe.kind === 'invalid',
        focusRevision,
      });
    } finally {
      if (generation === current) active = undefined;
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
    retry: () => load(state.page),
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
