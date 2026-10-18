import { ApiError } from '../api/client';
import type { AuthController } from '../auth/auth-controller';
import type { PracticeClient } from '../api/practice-client';
import {
  DRAFT_CAPACITY,
  practiceType,
  type PracticeType,
  DRAFT_LENGTH,
  type PracticePage,
  type PracticeItem,
} from './contracts';
export type PracticeState = {
  type: PracticeType;
  clearConfirmation: number | null;
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
    type: 'OUTPUT',
    clearConfirmation: null,
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
  let confirmationSequence = 0;
  const stores: Record<
    PracticeType,
    { drafts: Record<string, string>; authored: Map<string, string> }
  > = {
    OUTPUT: { drafts: {}, authored: new Map() },
    DESCRIPTIVE: { drafts: {}, authored: new Map() },
    SCENARIO: { drafts: {}, authored: new Map() },
    CODING: { drafts: {}, authored: new Map() },
  };
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
    const type = state.type;
    const store = stores[type];
    const request = new AbortController();
    abort = request;
    emit({
      ...state,
      page,
      status: 'loading',
      clearConfirmation: null,
      data: null,
      message: '',
      notice: '',
    });
    try {
      const data = await auth.runAuthenticatedRead(
        accountId,
        request.signal,
        (token, signal) => client.load(conceptId, page, token, signal, type),
      );
      if (version !== generation || request.signal.aborted) return;
      const drafts = { ...store.drafts };
      let changed = false;
      for (const item of data.data) {
        if (
          drafts[item.id] !== undefined &&
          store.authored.get(item.id) !== fingerprint(item)
        ) {
          delete drafts[item.id];
          store.authored.delete(item.id);
          changed = true;
        }
      }
      store.drafts = drafts;
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
    selectType(type: PracticeType) {
      if (!practiceType.safeParse(type).success || type === state.type)
        return Promise.resolve();
      abort?.abort();
      generation++;
      emit({
        ...state,
        type,
        page: 1,
        status: 'loading',
        data: null,
        drafts: { ...stores[type].drafts },
        clearConfirmation: null,
        message: '',
        notice: '',
      });
      return load(1);
    },
    retry: () => load(state.page, true),
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    setDraft(
      id: string,
      value: string,
      expectedType: PracticeType = state.type,
    ) {
      if (expectedType !== state.type) return;
      const store = stores[state.type];
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
        Object.values(stores).reduce(
          (sum, entry) => sum + Object.keys(entry.drafts).length,
          0,
        ) >= DRAFT_CAPACITY
      ) {
        emit({
          ...state,
          notice:
            'Draft capacity reached. Clear a draft or use Clear all drafts before drafting another question.',
        });
        return;
      }
      const drafts = { ...store.drafts };
      if (value) {
        drafts[id] = value;
        store.authored.set(id, fingerprint(item));
      } else {
        delete drafts[id];
        store.authored.delete(id);
      }
      store.drafts = drafts;
      emit({ ...state, drafts, notice: '', clearConfirmation: null });
    },
    clearDrafts() {
      emit({ ...state, clearConfirmation: ++confirmationSequence });
    },
    cancelClearDrafts() {
      emit({ ...state, clearConfirmation: null });
    },
    confirmClearDrafts(confirmation: number) {
      if (
        state.clearConfirmation === null ||
        state.clearConfirmation !== confirmation
      )
        return;
      for (const store of Object.values(stores)) {
        store.authored.clear();
        store.drafts = {};
      }
      emit({
        ...state,
        drafts: {},
        clearConfirmation: null,
        notice:
          'All drafts for this Concept, across all four question types, cleared.',
      });
    },
    cancel() {
      generation++;
      abort?.abort();
      for (const store of Object.values(stores)) {
        store.authored.clear();
        store.drafts = {};
      }
      emit({
        ...state,
        type: 'OUTPUT',
        page: 1,
        status: 'idle',
        data: null,
        drafts: {},
        clearConfirmation: null,
        notice: '',
        message: '',
      });
    },
  };
}
export type PracticeController = ReturnType<typeof createPracticeController>;
