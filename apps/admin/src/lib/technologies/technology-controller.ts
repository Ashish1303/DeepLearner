import type { AdminController } from '../auth/admin-controller';
import { TechnologyError } from './technology-client';
import {
  technologyDto,
  technologyQuery,
  technologyRequest,
  technologyPage,
  validateTechnologyPage,
  type Technology,
  type TechnologyPage,
  type TechnologyRequest,
} from './contracts';

export type TechnologyState = Readonly<{
  status:
    | 'idle'
    | 'loading'
    | 'ready'
    | 'saving'
    | 'success'
    | 'error'
    | 'conflict'
    | 'uncertain'
    | 'denied';
  page: TechnologyPage | null;
  detail: Technology | null;
  selected: string | null;
  query: { page: number; limit: number };
  message: string;
  needsReconciliation: boolean;
}>;
const empty = (
  status: TechnologyState['status'] = 'idle',
  message = '',
): TechnologyState => ({
  status,
  page: null,
  detail: null,
  selected: null,
  query: { page: 1, limit: 20 },
  message,
  needsReconciliation: false,
});
type Auth = Pick<
  AdminController,
  | 'getSnapshot'
  | 'subscribe'
  | 'requestTechnology'
  | 'hasTechnologyUncertainty'
  | 'reconcileTechnology'
>;
export function createTechnologyController(auth: Auth, accountId: string) {
  let state = empty(),
    generation = 0,
    active: AbortController | undefined,
    stop: (() => void) | undefined,
    connected = false,
    disposed = false;
  if (auth.hasTechnologyUncertainty())
    state = {
      ...empty(
        'uncertain',
        'A previous change could not be confirmed. Reload explicitly to reconcile before submitting.',
      ),
      needsReconciliation: true,
    };
  const listeners = new Set<() => void>();
  const update = (next: TechnologyState) => {
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
        !disposed &&
        connected &&
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
  const invalidate = () => {
    generation++;
    active?.abort();
    active = undefined;
    const uncertain = state.status === 'saving' || state.needsReconciliation;
    update({
      ...empty(
        'denied',
        uncertain
          ? 'A change could not be confirmed. Reconcile after signing in.'
          : '',
      ),
      needsReconciliation: uncertain,
    });
  };
  async function perform(raw: TechnologyRequest) {
    if (!eligible()) {
      invalidate();
      return;
    }
    const request = technologyRequest.safeParse(raw);
    if (!request.success) {
      update({
        ...state,
        status: 'error',
        message: new TechnologyError('VALIDATION_ERROR').message,
      });
      return;
    }
    const mutation = raw.kind === 'create' || raw.kind === 'patch';
    if (state.status === 'saving') return;
    if (mutation && state.needsReconciliation) {
      update({
        ...state,
        status: 'uncertain',
        message:
          'Reload the inventory or Technology to reconcile the previous change first.',
      });
      return;
    }
    if (
      raw.kind === 'patch' &&
      (!state.detail ||
        state.detail.id !== raw.id ||
        state.detail.status !== 'DRAFT' ||
        state.detail.revision !== raw.input.revision)
    ) {
      update({
        ...state,
        status: 'conflict',
        detail: null,
        needsReconciliation: true,
        message: 'Reload this Technology before applying a new change.',
      });
      return;
    }
    active?.abort();
    const abort = new AbortController();
    active = abort;
    const version = ++generation;
    const query = raw.kind === 'list' ? { ...raw.query } : state.query;
    const selected =
      raw.kind === 'detail' || raw.kind === 'patch' ? raw.id : null;
    update({
      ...state,
      status: mutation ? 'saving' : 'loading',
      page: raw.kind === 'list' ? null : state.page,
      detail:
        raw.kind === 'detail' || raw.kind === 'create' ? null : state.detail,
      selected,
      query,
      message: '',
    });
    const current = () =>
      version === generation && !abort.signal.aborted && eligible();
    try {
      const value = await (state.needsReconciliation && !mutation
        ? auth.reconcileTechnology(
            accountId,
            request.data as Extract<
              TechnologyRequest,
              { kind: 'list' | 'detail' }
            >,
            abort.signal,
          )
        : auth.requestTechnology(accountId, request.data, abort.signal));
      if (!current()) return;
      if (raw.kind === 'list') {
        const parsedPage = technologyPage.safeParse(value);
        if (!parsedPage.success) throw new TechnologyError('INVALID_RESPONSE');
        const page = validateTechnologyPage(
          parsedPage.data.items,
          parsedPage.data.pagination,
          raw.query,
        );
        update({
          ...state,
          status: 'ready',
          page,
          detail: null,
          selected: null,
          needsReconciliation: false,
          message: page.items.length ? '' : 'No Technologies on this page.',
        });
      } else {
        const detail = technologyDto.parse(value);
        if (
          (raw.kind === 'detail' || raw.kind === 'patch') &&
          detail.id !== raw.id
        )
          throw new TechnologyError('INVALID_RESPONSE');
        update({
          ...state,
          status: mutation ? 'success' : 'ready',
          detail,
          selected: detail.id,
          page: mutation ? null : state.page,
          needsReconciliation: false,
          message: mutation ? 'Draft saved.' : '',
        });
      }
    } catch (error) {
      if (!current()) return;
      const safe =
        error instanceof TechnologyError
          ? error
          : new TechnologyError('INVALID_RESPONSE');
      const uncertain =
        mutation &&
        (safe.status >= 500 ||
          safe.status === 0 ||
          [
            'INVALID_RESPONSE',
            'TIMEOUT',
            'NETWORK_ERROR',
            'CANCELLED',
          ].includes(safe.code));
      const conflict = mutation && safe.status === 409;
      update({
        ...state,
        status: uncertain ? 'uncertain' : conflict ? 'conflict' : 'error',
        detail: uncertain || conflict ? null : state.detail,
        page: uncertain || conflict ? null : state.page,
        needsReconciliation: state.needsReconciliation || uncertain || conflict,
        message: uncertain
          ? 'This change could not be confirmed and will not be replayed. Reload to reconcile before submitting again.'
          : safe.message,
      });
    } finally {
      if (active === abort) active = undefined;
    }
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    connect() {
      if (disposed || connected) return () => {};
      connected = true;
      try {
        stop = auth.subscribe(() => {
          if (!eligible()) invalidate();
        });
      } catch {
        invalidate();
      }
      return () => {
        connected = false;
        stop?.();
        stop = undefined;
        invalidate();
      };
    },
    list(page = state.query.page, limit = state.query.limit) {
      const query = technologyQuery.safeParse({ page, limit });
      if (!query.success) {
        update({
          ...state,
          status: 'error',
          message: new TechnologyError('VALIDATION_ERROR').message,
        });
        return Promise.resolve();
      }
      return perform({ kind: 'list', query: query.data });
    },
    detail(id: string) {
      return perform({ kind: 'detail', id });
    },
    create(input: Extract<TechnologyRequest, { kind: 'create' }>['input']) {
      return perform({ kind: 'create', input });
    },
    patch(
      id: string,
      input: Extract<TechnologyRequest, { kind: 'patch' }>['input'],
    ) {
      return perform({ kind: 'patch', id, input });
    },
    cancel() {
      const saving = state.status === 'saving';
      generation++;
      active?.abort();
      active = undefined;
      update({
        ...empty(
          saving ? 'uncertain' : 'idle',
          saving
            ? 'This change could not be confirmed. Reload to reconcile.'
            : '',
        ),
        needsReconciliation: state.needsReconciliation || saving,
      });
    },
    dispose() {
      disposed = true;
      connected = false;
      stop?.();
      stop = undefined;
      invalidate();
      listeners.clear();
    },
  };
}
export type TechnologyController = ReturnType<
  typeof createTechnologyController
>;
