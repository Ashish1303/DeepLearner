import type { AuthController } from '../auth/auth-controller';
import { ApiError } from '../api/client';
import {
  DashboardError,
  type DashboardClient,
  type DashboardFailure,
} from '../api/dashboard-client';
import {
  dashboardCursor,
  parseDashboardPage,
  type DashboardData,
} from './contracts';

export type DashboardState = {
  status: 'idle' | 'loading' | 'ready' | DashboardFailure;
  data: DashboardData | null;
  cursor: string | null;
  message: string;
};
const messages: Record<DashboardFailure, string> = {
  denied: 'Dashboard activity is not available for this account.',
  unavailable: 'Dashboard activity is temporarily unavailable.',
  'rate-limited': 'Too many requests. Please wait before retrying.',
  error: 'Dashboard activity could not be confirmed. Please retry.',
};
type Auth = Pick<
  AuthController,
  'runAuthenticatedRead' | 'getSnapshot' | 'subscribe'
>;

/** Account identity is a trusted local binding, never a request query field. */
export function createDashboardController(
  client: DashboardClient,
  auth: Auth,
  accountId: string,
) {
  let state: DashboardState = {
    status: 'idle',
    data: null,
    cursor: null,
    message: '',
  };
  let generation = 0;
  let target: string | null = null;
  let nextCursor: string | null = null;
  type Flight = {
    cursor: string | null;
    version: number;
    abort: AbortController;
    promise: Promise<void>;
  };
  let active: Flight | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: DashboardState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  const eligible = () => {
    try {
      const current = auth.getSnapshot();
      return (
        dashboardCursor.safeParse(accountId).success &&
        current.status === 'authenticated' &&
        !current.pending &&
        current.user?.id === accountId &&
        current.user.role === 'STUDENT' &&
        current.user.status === 'ACTIVE' &&
        current.user.emailVerified
      );
    } catch {
      return false;
    }
  };
  const invalidate = (status: 'idle' | 'denied') => {
    generation++;
    active?.abort.abort();
    active = undefined;
    target = nextCursor = null;
    emit({
      status,
      data: null,
      cursor: null,
      message: status === 'denied' ? messages.denied : '',
    });
  };
  function observe() {
    try {
      unsubscribe ??= auth.subscribe(() => {
        if (!eligible()) invalidate('denied');
      });
      return true;
    } catch {
      invalidate('denied');
      return false;
    }
  }
  async function perform(request: Flight) {
    const current = () =>
      request.version === generation && !request.abort.signal.aborted;
    try {
      if (!current()) return;
      if (!eligible()) {
        invalidate('denied');
        return;
      }
      const raw = await auth.runAuthenticatedRead(
        accountId,
        request.abort.signal,
        (token, signal) => client.load(request.cursor, token, signal),
      );
      if (!current()) return;
      if (!eligible()) {
        invalidate('denied');
        return;
      }
      const data = parseDashboardPage(raw, request.cursor);
      nextCursor = data.pagination.nextCursor;
      emit({ status: 'ready', data, cursor: request.cursor, message: '' });
    } catch (error) {
      if (!current()) return;
      if (!eligible()) {
        invalidate('denied');
        return;
      }
      let kind: DashboardFailure = 'error';
      if (error instanceof ApiError && [401, 403].includes(error.status))
        kind = 'denied';
      else if (error instanceof DashboardError) kind = error.kind;
      nextCursor = null;
      emit({
        status: kind,
        data: null,
        cursor: request.cursor,
        message: messages[kind],
      });
    } finally {
      if (active === request) active = undefined;
    }
  }
  function loadPage(cursor: string | null) {
    if (!observe()) return Promise.resolve();
    if (!eligible()) {
      invalidate('denied');
      return Promise.resolve();
    }
    if (!dashboardCursor.safeParse(cursor).success) {
      invalidate('idle');
      emit({
        status: 'error',
        data: null,
        cursor: null,
        message: messages.error,
      });
      return Promise.resolve();
    }
    if (active?.cursor === cursor) return active.promise;
    active?.abort.abort();
    const request: Flight = {
      cursor,
      version: ++generation,
      abort: new AbortController(),
      promise: Promise.resolve(),
    };
    request.promise = Promise.resolve().then(() => perform(request));
    active = request;
    target = cursor;
    nextCursor = null;
    emit({ status: 'loading', data: null, cursor, message: '' });
    return request.promise;
  }
  return {
    load: () => loadPage(null),
    refresh: () => loadPage(null),
    first: () => loadPage(null),
    retry: () => loadPage(target),
    next() {
      if (!eligible()) {
        invalidate('denied');
        return Promise.resolve();
      }
      if (active) return active.promise;
      return state.status === 'ready' && nextCursor !== null
        ? loadPage(nextCursor)
        : Promise.resolve();
    },
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = undefined;
      invalidate('idle');
    },
  };
}
export type DashboardController = ReturnType<typeof createDashboardController>;
