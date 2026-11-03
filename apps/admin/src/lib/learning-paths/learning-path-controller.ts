import type { AdminController } from '../auth/admin-controller';
import {
  technologyDto,
  technologyPage,
  validateTechnologyPage,
  type Technology,
  type TechnologyPage,
} from '../technologies/contracts';
import { TechnologyError } from '../technologies/technology-client';
import {
  learningPathDto,
  validateLearningPathPage,
  type LearningPath,
  type LearningPathPage,
} from './contracts';
import { LearningPathError } from './learning-path-client';

export type LearningPathState = Readonly<{
  status:
    | 'idle'
    | 'loading-parents'
    | 'loading-paths'
    | 'loading-detail'
    | 'ready'
    | 'error'
    | 'denied';
  parents: TechnologyPage | null;
  parentPage: number;
  parent: Technology | null;
  paths: LearningPathPage | null;
  page: number;
  detail: LearningPath | null;
  selected: string | null;
  message: string;
}>;
const initial: LearningPathState = Object.freeze({
  status: 'idle',
  parents: null,
  parentPage: 1,
  parent: null,
  paths: null,
  page: 1,
  detail: null,
  selected: null,
  message: '',
});
type Action =
  | { kind: 'parents'; page: number }
  | { kind: 'paths'; technologyId: string; page: number; refresh: boolean }
  | { kind: 'detail'; technologyId: string; id: string };
type Auth = Pick<
  AdminController,
  'subscribe' | 'getSnapshot' | 'requestTechnology' | 'requestLearningPath'
>;
export function createLearningPathController(auth: Auth, accountId: string) {
  let state = initial,
    generation = 0,
    connected = false,
    disposed = false;
  let active: AbortController | undefined,
    stop: (() => void) | undefined,
    last: Action | undefined;
  const listeners = new Set<() => void>();
  const update = (next: LearningPathState) => {
    state = Object.freeze(next);
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* Rendering cannot interrupt invalidation. */
      }
    }
  };
  const eligible = () => {
    try {
      const s = auth.getSnapshot();
      return (
        connected &&
        !disposed &&
        s.status === 'eligible' &&
        !s.pending &&
        s.user?.id === accountId &&
        s.user.role === 'ADMIN' &&
        s.user.status === 'ACTIVE' &&
        s.user.emailVerified
      );
    } catch {
      return false;
    }
  };
  const clear = (denied = false) => {
    generation++;
    active?.abort();
    active = undefined;
    last = undefined;
    update({ ...initial, status: denied ? 'denied' : 'idle' });
  };
  async function perform(action: Action) {
    if (!eligible()) {
      clear(true);
      return;
    }
    active?.abort();
    const abort = new AbortController();
    active = abort;
    const version = ++generation;
    const current = () =>
      generation === version && !abort.signal.aborted && eligible();
    last = { ...action };
    if (action.kind === 'parents')
      update({
        ...initial,
        status: 'loading-parents',
        parentPage: action.page,
      });
    else
      update({
        ...state,
        status: action.kind === 'detail' ? 'loading-detail' : 'loading-paths',
        paths: action.kind === 'paths' ? null : state.paths,
        page: action.kind === 'paths' ? action.page : state.page,
        detail: null,
        selected: action.kind === 'detail' ? action.id : null,
        message: '',
      });
    try {
      if (action.kind === 'parents') {
        const query = { page: action.page, limit: 20 };
        const raw = await auth.requestTechnology(
          accountId,
          { kind: 'list', query },
          abort.signal,
        );
        if (!current()) return;
        const parsed = technologyPage.parse(raw);
        const parents = validateTechnologyPage(
          parsed.items,
          parsed.pagination,
          query,
        );
        update({
          ...state,
          status: 'ready',
          parents,
          message: parents.items.length ? '' : 'No Technologies on this page.',
        });
      } else {
        if (!state.parent || state.parent.id !== action.technologyId)
          throw new LearningPathError('INVALID_RESPONSE');
        if (action.kind === 'paths' && action.refresh) {
          const raw = await auth.requestTechnology(
            accountId,
            { kind: 'detail', id: action.technologyId },
            abort.signal,
          );
          if (!current()) return;
          const parent = technologyDto.parse(raw);
          if (parent.id !== action.technologyId)
            throw new LearningPathError('INVALID_RESPONSE');
          update({ ...state, parent });
        }
        if (!current()) return;
        if (action.kind === 'paths') {
          const query = {
            technologyId: action.technologyId,
            page: action.page,
            limit: 20,
          };
          const raw = await auth.requestLearningPath(
            accountId,
            { kind: 'list', query },
            abort.signal,
          );
          if (!current()) return;
          const paths = validateLearningPathPage(raw, query);
          update({
            ...state,
            status: 'ready',
            paths,
            detail: null,
            selected: null,
            message: paths.items.length
              ? ''
              : 'No Learning Paths on this page.',
          });
        } else {
          const raw = await auth.requestLearningPath(
            accountId,
            {
              kind: 'detail',
              technologyId: action.technologyId,
              id: action.id,
            },
            abort.signal,
          );
          if (!current()) return;
          const detail = learningPathDto.parse(raw);
          if (
            detail.id !== action.id ||
            detail.technologyId !== action.technologyId
          )
            throw new LearningPathError('INVALID_RESPONSE');
          update({ ...state, status: 'ready', detail });
        }
      }
    } catch (error) {
      if (!current()) return;
      const safe =
        error instanceof LearningPathError || error instanceof TechnologyError
          ? error
          : new LearningPathError('INVALID_RESPONSE');
      if ([401, 403].includes(safe.status)) {
        clear(true);
        return;
      }
      const parentMissing =
        safe instanceof LearningPathError
          ? safe.code === 'PARENT_NOT_FOUND'
          : safe.status === 404;
      if (parentMissing) {
        last = { kind: 'parents', page: state.parentPage };
        update({
          ...state,
          parent: null,
          paths: null,
          detail: null,
          selected: null,
          status: 'error',
          message: 'This Technology is unavailable. Select another Technology.',
        });
      } else
        update({
          ...state,
          status: 'error',
          detail: null,
          message:
            safe instanceof TechnologyError
              ? safe.code === 'RATE_LIMITED'
                ? 'Too many requests. Wait before trying again.'
                : 'Technology selection is temporarily unavailable.'
              : safe.message,
        });
    } finally {
      if (active === abort) active = undefined;
    }
  }
  const validPage = (page: number) =>
    Number.isInteger(page) && page >= 1 && (page - 1) * 20 <= 10000;
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    connect() {
      if (connected || disposed) return () => {};
      connected = true;
      try {
        stop = auth.subscribe(() => {
          if (!eligible()) clear(true);
        });
      } catch {
        clear(true);
      }
      return () => {
        connected = false;
        stop?.();
        stop = undefined;
        clear();
      };
    },
    parents(page = state.parentPage) {
      if (!validPage(page)) return Promise.resolve();
      return perform({ kind: 'parents', page });
    },
    selectTechnology(id: string) {
      const parent = state.parents?.items.find((v) => v.id === id);
      if (!parent) return Promise.resolve();
      update({
        ...state,
        parent,
        paths: null,
        detail: null,
        selected: null,
        page: 1,
      });
      return perform({
        kind: 'paths',
        technologyId: parent.id,
        page: 1,
        refresh: false,
      });
    },
    paths(page = state.page) {
      if (!state.parent || !validPage(page)) return Promise.resolve();
      return perform({
        kind: 'paths',
        technologyId: state.parent.id,
        page,
        refresh: false,
      });
    },
    detail(id: string) {
      if (!state.parent || !state.paths?.items.some((v) => v.id === id))
        return Promise.resolve();
      return perform({ kind: 'detail', technologyId: state.parent.id, id });
    },
    refresh() {
      return state.parent
        ? perform({
            kind: 'paths',
            technologyId: state.parent.id,
            page: state.page,
            refresh: true,
          })
        : perform({ kind: 'parents', page: state.parentPage });
    },
    retry() {
      return last ? perform({ ...last }) : Promise.resolve();
    },
    cancel() {
      clear();
    },
    dispose() {
      disposed = true;
      connected = false;
      stop?.();
      stop = undefined;
      clear();
      listeners.clear();
    },
  };
}
export type LearningPathController = ReturnType<
  typeof createLearningPathController
>;
