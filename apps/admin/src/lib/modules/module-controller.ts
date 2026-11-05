import type { AdminController } from '../auth/admin-controller';
import {
  moduleDto,
  moduleQuery,
  validateModulePage,
  type Module,
  type ModulePage,
  type ModuleRequest,
} from './contracts';
import { ModuleError } from './module-client';

type Auth = Pick<
  AdminController,
  'subscribe' | 'getSnapshot' | 'requestModule'
>;
export type ModuleState = Readonly<{
  status: 'idle' | 'loading' | 'ready' | 'error' | 'denied';
  page: ModulePage | null;
  detail: Module | null;
  message: string;
}>;
const initial: ModuleState = Object.freeze({
  status: 'idle',
  page: null,
  detail: null,
  message: '',
});
export function createModuleController(
  auth: Auth,
  account: string,
  technologyId: string,
  learningPathId: string,
) {
  let state = initial,
    connected = false,
    generation = 0;
  let active: AbortController | undefined,
    stop: (() => void) | undefined,
    last: ModuleRequest | undefined;
  const listeners = new Set<() => void>();
  const update = (next: ModuleState) => {
    state = Object.freeze(next);
    for (const fn of listeners) {
      try {
        fn();
      } catch {
        /* Invalidation must complete. */
      }
    }
  };
  const eligible = () => {
    const s = auth.getSnapshot();
    return (
      connected &&
      s.status === 'eligible' &&
      !s.pending &&
      s.user?.id === account &&
      s.user.role === 'ADMIN' &&
      s.user.status === 'ACTIVE' &&
      s.user.emailVerified
    );
  };
  const clear = (denied = false) => {
    generation++;
    active?.abort();
    active = undefined;
    last = undefined;
    update({ ...initial, status: denied ? 'denied' : 'idle' });
  };
  async function execute(request: ModuleRequest) {
    if (!eligible()) {
      clear(true);
      return;
    }
    active?.abort();
    const abort = new AbortController(),
      epoch = ++generation;
    active = abort;
    last = request;
    update({
      ...state,
      status: 'loading',
      detail: null,
      page: request.kind === 'list' ? null : state.page,
      message: '',
    });
    const current = () =>
      epoch === generation && !abort.signal.aborted && eligible();
    try {
      const raw = await auth.requestModule(account, request, abort.signal);
      if (!current()) return;
      if (request.kind === 'list') {
        const page = validateModulePage(raw, request.query);
        update({
          status: 'ready',
          page,
          detail: null,
          message: page.items.length ? '' : 'No Modules on this page.',
        });
      } else {
        const detail = moduleDto.parse(raw);
        if (
          detail.id !== request.id ||
          detail.technologyId !== technologyId ||
          detail.learningPathId !== learningPathId
        )
          throw new ModuleError('INVALID_RESPONSE');
        update({ ...state, status: 'ready', detail, message: '' });
      }
    } catch (error) {
      if (!current()) return;
      const safe =
        error instanceof ModuleError
          ? error
          : new ModuleError('INVALID_RESPONSE');
      update({
        ...initial,
        status: [401, 403].includes(safe.status) ? 'denied' : 'error',
        message: safe.message,
      });
    } finally {
      if (active === abort) active = undefined;
      abort.abort();
    }
  }
  const controller = {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    connect() {
      if (connected) return () => {};
      connected = true;
      stop = auth.subscribe(() => {
        if (!eligible()) clear(true);
      });
      return () => {
        connected = false;
        stop?.();
        stop = undefined;
        clear();
      };
    },
    list(page = 1) {
      const query = moduleQuery.safeParse({
        technologyId,
        learningPathId,
        page,
        limit: 20,
      });
      return query.success
        ? execute({ kind: 'list', query: query.data })
        : Promise.resolve();
    },
    detail(id: string) {
      return state.page?.items.some((item) => item.id === id)
        ? execute({ kind: 'detail', id, technologyId, learningPathId })
        : Promise.resolve();
    },
    retry() {
      return last ? execute(last) : Promise.resolve();
    },
  };
  return controller;
}
