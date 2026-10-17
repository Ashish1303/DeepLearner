import { ApiError } from '../api/client';
import type { AuthController } from '../auth/auth-controller';
import type { PracticeClient } from '../api/practice-client';
import {
  DRAFT_CAPACITY,
  DRAFT_LENGTH,
  type PracticePage,
  type PracticeItem,
} from './contracts';
export type PracticeState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  page: number;
  data: PracticePage | null;
  message: string;
  notice: string;
  drafts: Readonly<Record<string, string>>;
  focusRevision: number;
};
export function createPracticeController(
  client: PracticeClient,
  auth: Pick<AuthController, 'runAuthenticatedRead'>,
  accountId: string,
  conceptId: string,
) {
  let state: PracticeState = {
    status: 'idle',
    page: 1,
    data: null,
    message: '',
    notice: '',
    drafts: {},
    focusRevision: 0,
  };
  let generation = 0;
  let abort: AbortController | undefined;
  const authored = new Map<string, string>();
  const listeners = new Set<() => void>();
  const emit = (next: PracticeState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const fingerprint = (item: PracticeItem) =>
    JSON.stringify([item.prompt, item.starterCode, item.language]);
  async function load(page = state.page, focus = false) {
    abort?.abort();
    const version = ++generation;
    const request = new AbortController();
    abort = request;
    emit({
      ...state,
      page,
      status: 'loading',
      data: null,
      message: '',
      notice: '',
    });
    try {
      const data = await auth.runAuthenticatedRead(
        accountId,
        request.signal,
        (token, signal) => client.load(conceptId, page, token, signal),
      );
      if (version !== generation || request.signal.aborted) return;
      const drafts = { ...state.drafts };
      let changed = false;
      for (const item of data.data) {
        if (
          drafts[item.id] !== undefined &&
          authored.get(item.id) !== fingerprint(item)
        ) {
          delete drafts[item.id];
          authored.delete(item.id);
          changed = true;
        }
      }
      emit({
        ...state,
        status: 'ready',
        data,
        drafts,
        notice: changed
          ? 'Question content changed. Its previous draft was cleared.'
          : '',
        focusRevision: state.focusRevision + (focus ? 1 : 0),
      });
    } catch (error) {
      if (version !== generation || request.signal.aborted) return;
      emit({
        ...state,
        status: 'error',
        data: null,
        message:
          error instanceof ApiError
            ? error.message
            : 'Practice could not be loaded. Please retry.',
        focusRevision: state.focusRevision + (focus ? 1 : 0),
      });
    }
  }
  return {
    load,
    retry: () => load(state.page, true),
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setDraft(id: string, value: string) {
      const item = state.data?.data.find((question) => question.id === id);
      if (state.status !== 'ready' || !item) return;
      if (value.length > DRAFT_LENGTH) {
        emit({
          ...state,
          notice: 'Drafts can contain at most 10,000 characters.',
        });
        return;
      }
      if (
        value &&
        state.drafts[id] === undefined &&
        Object.keys(state.drafts).length >= DRAFT_CAPACITY
      ) {
        emit({
          ...state,
          notice:
            'Draft capacity reached. Clear a draft or use Clear all drafts before drafting another question.',
        });
        return;
      }
      const drafts = { ...state.drafts };
      if (value) {
        drafts[id] = value;
        authored.set(id, fingerprint(item));
      } else {
        delete drafts[id];
        authored.delete(id);
      }
      emit({ ...state, drafts, notice: '' });
    },
    clearDrafts() {
      authored.clear();
      emit({ ...state, drafts: {}, notice: 'All drafts cleared.' });
    },
    cancel() {
      generation++;
      abort?.abort();
      authored.clear();
      emit({
        ...state,
        status: 'idle',
        data: null,
        drafts: {},
        notice: '',
        message: '',
      });
    },
  };
}
export type PracticeController = ReturnType<typeof createPracticeController>;
