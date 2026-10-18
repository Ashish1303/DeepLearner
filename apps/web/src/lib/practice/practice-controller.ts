import { ApiError } from '../api/client';
import { PracticeSubmissionError } from '../api/practice-client';
import type { AuthController } from '../auth/auth-controller';
import type { PracticeClient } from '../api/practice-client';
import {
  DRAFT_CAPACITY,
  practiceType,
  type PracticeType,
  DRAFT_LENGTH,
  type PracticePage,
  submittedAnswer,
  type PracticeUnlockResult,
  questionRevision,
  publicQuestionText,
  attemptReceipt,
} from './contracts';
export type PracticeReveal = {
  questionId: string;
  type: PracticeType;
  status: 'pending' | 'ready' | 'error';
  submittedAnswer: string;
  result: PracticeUnlockResult | null;
  message: string;
};
export type PracticeState = {
  submissions?: Readonly<Record<string, 'uncertain' | 'saved' | 'refused'>>;
  reveal: PracticeReveal | null;
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
    reveal: null,
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
  let unlockGeneration = 0;
  let unlockAbort: AbortController | undefined;
  type Memo = {
    key: string;
    value: string;
    context: string;
    status: 'uncertain' | 'saved' | 'refused';
  };
  const memos = new Map<string, Memo>();
  const memoId = (type: PracticeType, id: string) => type + ':' + id;
  const invalidateReveal = () => {
    unlockGeneration++;
    unlockAbort?.abort();
    unlockAbort = undefined;
  };
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
    state = {
      ...next,
      submissions: Object.fromEntries(
        Array.from(memos)
          .filter(([key]) => key.startsWith(next.type + ':'))
          .map(([key, memo]) => [key.slice(next.type.length + 1), memo.status]),
      ),
    };
    listeners.forEach((fn) => fn());
  };
  const fingerprint = publicQuestionText;
  async function load(page = state.page, focus = false) {
    invalidateReveal();
    abort?.abort();
    const version = ++generation;
    const type = state.type;
    const store = stores[type];
    const request = new AbortController();
    abort = request;
    emit({
      ...state,
      reveal: null,
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
          memos.delete(memoId(type, item.id));
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
    async submitAnswer(id: string, expectedType: PracticeType = state.type) {
      const item = state.data?.data.find((value) => value.id === id);
      if (
        state.status !== 'ready' ||
        expectedType !== state.type ||
        !item ||
        (state.reveal?.questionId === id && state.reveal.status === 'pending')
      )
        return;
      const value = state.drafts[id] ?? '';
      if (!submittedAnswer.safeParse(value).success) {
        emit({
          ...state,
          notice: 'Enter a nonblank answer of at most 10,000 characters.',
        });
        return;
      }
      const memoKey = memoId(state.type, id);
      if (memos.get(memoKey)?.status === 'refused') {
        emit({
          ...state,
          notice: 'Refresh the question and start a new submission explicitly.',
        });
        return;
      }
      invalidateReveal();
      const version = unlockGeneration,
        type = state.type,
        context = fingerprint(item);
      const request = new AbortController();
      unlockAbort = request;
      const current = () =>
        version === unlockGeneration &&
        !request.signal.aborted &&
        state.status === 'ready' &&
        state.type === type &&
        state.drafts[id] === value &&
        state.data?.data.some(
          (question) => question.id === id && fingerprint(question) === context,
        );
      emit({
        ...state,
        notice: '',
        reveal: {
          questionId: id,
          type,
          status: 'pending',
          submittedAnswer: value,
          result: null,
          message: '',
        },
      });
      try {
        const revision = await questionRevision(item);
        if (!current()) return;
        let memo = memos.get(memoKey);
        if (
          !memo ||
          memo.context !== context ||
          memo.value !== value ||
          memo.status === 'saved'
        ) {
          memo = {
            key: globalThis.crypto.randomUUID(),
            value,
            context,
            status: 'uncertain',
          };
          memos.set(memoKey, memo);
        }
        const submission = { key: memo.key, questionRevision: revision };
        emit({ ...state });
        const result = await auth.runAuthenticatedRead(
          accountId,
          request.signal,
          (token, signal) =>
            client.unlock(
              conceptId,
              id,
              value,
              token,
              signal,
              type,
              submission,
            ),
        );
        if (!current()) return;
        if (
          result.id !== id ||
          result.conceptId !== conceptId ||
          result.type !== type
        )
          throw new ApiError('INVALID_RESPONSE');
        attemptReceipt.parse(result.attempt);
        memo.status = 'saved';
        emit({
          ...state,
          reveal: {
            questionId: id,
            type,
            status: 'ready',
            submittedAnswer: value,
            result,
            message: '',
          },
        });
      } catch (error) {
        if (!current()) return;
        const memo = memos.get(memoKey);
        if (
          memo &&
          error instanceof PracticeSubmissionError &&
          error.reason !== 'PRACTICE_COMMIT_UNCONFIRMED'
        )
          memo.status = 'refused';
        emit({
          ...state,
          notice:
            memo?.status === 'uncertain'
              ? 'This attempt may have been saved. Retry the unchanged answer to confirm it.'
              : state.notice,
          reveal: {
            questionId: id,
            type,
            status: 'error',
            submittedAnswer: value,
            result: null,
            message:
              error instanceof ApiError
                ? error.message
                : 'This attempt may have been saved. Retry the unchanged answer to confirm it.',
          },
        });
      }
    },
    async startNewSubmission(
      id: string,
      expectedType: PracticeType = state.type,
    ) {
      if (
        state.status !== 'ready' ||
        expectedType !== state.type ||
        !state.data?.data.some((item) => item.id === id)
      )
        return;
      invalidateReveal();
      memos.delete(memoId(state.type, id));
      emit({
        ...state,
        reveal: null,
        notice:
          'A previous attempt may already have been saved. Submit explicitly to save another attempt.',
      });
      await load(state.page, true);
    },
    load,
    selectType(type: PracticeType) {
      if (!practiceType.safeParse(type).success || type === state.type)
        return Promise.resolve();
      abort?.abort();
      generation++;
      invalidateReveal();
      emit({
        ...state,
        reveal: null,
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
      const previous = memos.get(memoId(state.type, id));
      if (previous && previous.value !== value)
        memos.delete(memoId(state.type, id));
      const clearReveal = state.reveal?.questionId === id;
      if (clearReveal) invalidateReveal();
      emit({
        ...state,
        drafts,
        notice:
          previous && previous.value !== value
            ? 'A previous attempt may already have been saved. Editing does not delete it.'
            : '',
        clearConfirmation: null,
        reveal: clearReveal ? null : state.reveal,
      });
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
      invalidateReveal();
      memos.clear();
      for (const store of Object.values(stores)) {
        store.authored.clear();
        store.drafts = {};
      }
      emit({
        ...state,
        drafts: {},
        reveal: null,
        clearConfirmation: null,
        notice:
          'All drafts for this Concept, across all four question types, cleared.',
      });
    },
    cancel() {
      invalidateReveal();
      memos.clear();
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
        reveal: null,
        drafts: {},
        clearConfirmation: null,
        notice: '',
        message: '',
      });
    },
  };
}
export type PracticeController = ReturnType<typeof createPracticeController>;
