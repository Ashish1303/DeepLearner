import { ApiError } from '../api/client';
import type { TechnologyClient } from '../api/technology-client';
import { catalogPageNumber, type Technology } from './contracts';
export interface CatalogState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  totalPages: number;
  items: Technology[];
  message: string;
  invalidRequest: boolean;
  focusRevision: number;
}
export function createCatalogController(client: TechnologyClient) {
  let state: CatalogState = {
    status: 'idle',
    page: 1,
    totalPages: 0,
    items: [],
    message: '',
    invalidRequest: false,
    focusRevision: 0,
  };
  let generation = 0;
  let active: AbortController | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: CatalogState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };
  async function load(page: number, explicitPageChange = false) {
    if (!catalogPageNumber.safeParse(page).success) return;
    const current = ++generation;
    active?.abort();
    const request = new AbortController();
    active = request;
    const focusRevision = state.focusRevision + (explicitPageChange ? 1 : 0);
    publish({
      ...state,
      status: 'loading',
      page,
      items: [],
      message: '',
      invalidRequest: false,
    });
    try {
      const response = await client.list(page, request.signal);
      if (current !== generation || request.signal.aborted) return;
      publish({
        ...state,
        status: 'ready',
        items: response.data,
        totalPages: response.meta.totalPages,
        focusRevision,
      });
    } catch (error) {
      if (current !== generation || request.signal.aborted) return;
      const safe =
        error instanceof ApiError ? error : new ApiError('NETWORK_ERROR');
      publish({
        ...state,
        status: 'error',
        message: safe.message,
        invalidRequest: safe.status === 400,
        focusRevision,
      });
    } finally {
      if (current === generation) active = undefined;
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    load,
    retry: () => load(state.page),
    cancel() {
      ++generation;
      active?.abort();
      active = undefined;
      publish({
        ...state,
        status: 'idle',
        items: [],
        message: '',
        invalidRequest: false,
      });
    },
  };
}
