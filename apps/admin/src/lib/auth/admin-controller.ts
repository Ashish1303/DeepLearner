import {
  AdminApiError,
  type AdminClient,
  type AdminErrorCode,
} from './admin-client';
import {
  currentUserSchema,
  loginInput,
  loginSchema,
  projectAdmin,
  refreshSchema,
  type AdminIdentity,
} from './contracts';
import {
  AdminCoordinationError,
  type AdminControl,
  type AdminCoordination,
} from './browser-coordination';

export type AdminState = Readonly<{
  status:
    | 'idle'
    | 'checking'
    | 'eligible'
    | 'anonymous'
    | 'denied'
    | 'expired'
    | 'unavailable'
    | 'rate-limited'
    | 'error'
    | 'unsupported'
    | 'uncertain';
  user: AdminIdentity | null;
  pending: boolean;
  message: string;
}>;
const initial: AdminState = Object.freeze({
  status: 'idle',
  user: null,
  pending: false,
  message: '',
});
const obsolete = Symbol('obsolete Admin operation');
const uncertainMessage =
  'The session request could not be confirmed. Sign in again or retry sign-out; restoration will not be replayed.';
export function createAdminController(
  api: AdminClient,
  coordination: AdminCoordination,
  now: () => number = () => performance.now(),
) {
  let state = initial;
  let token: string | undefined;
  let accountId: string | undefined;
  let expiresAt = 0;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let connected = false;
  let disposed = false;
  let stopListening: (() => void) | undefined;
  let flight: Promise<void> | undefined;
  let loggingOut = false;
  let operationAbort: AbortController | undefined;
  const listeners = new Set<() => void>();
  const update = (next: AdminState) => {
    state = Object.freeze(next);
    for (const fn of listeners) {
      // A rendering subscriber must not interrupt invalidation or cleanup.
      try {
        fn();
      } catch {
        /* Subscriber owns its rendering failure. */
      }
    }
  };
  function clearAuthority() {
    token = undefined;
    accountId = undefined;
    expiresAt = 0;
    clearTimeout(expiry);
    expiry = undefined;
  }
  function invalidate(
    status: AdminState['status'],
    message = '',
    pending = false,
  ) {
    generation++;
    operationAbort?.abort();
    clearAuthority();
    update({ status, user: null, pending, message });
  }
  function check(version: number) {
    if (disposed || !connected || generation !== version) throw obsolete;
  }
  function expireIfNeeded() {
    if (token && now() >= expiresAt)
      invalidate(
        'expired',
        new AdminApiError('AUTH_ACCESS_TOKEN_EXPIRED').message,
      );
  }
  function ready() {
    if (disposed || !connected || !coordination.supported()) {
      invalidate('unsupported', new AdminCoordinationError().message);
      return false;
    }
    return true;
  }
  function publish(control: AdminControl) {
    try {
      coordination.publish(control);
    } catch {
      invalidate('unsupported', new AdminCoordinationError().message);
      throw obsolete;
    }
  }
  function uncertain(version: number) {
    check(version);
    clearAuthority();
    update({
      status: 'uncertain',
      user: null,
      pending: false,
      message: uncertainMessage,
    });
    try {
      publish('uncertain');
    } catch {
      /* Coordination failure already removed authority. */
    }
  }
  function failure(error: unknown, version: number, mutationSent: boolean) {
    if (generation !== version || disposed || error === obsolete) return;
    clearAuthority();
    if (error instanceof AdminCoordinationError) {
      update({
        status: 'unsupported',
        user: null,
        pending: false,
        message: new AdminCoordinationError().message,
      });
      return;
    }
    const safe =
      error instanceof AdminApiError
        ? error
        : new AdminApiError('NETWORK_ERROR');
    if (
      mutationSent &&
      (['NETWORK_ERROR', 'TIMEOUT', 'CANCELLED', 'INVALID_RESPONSE'].includes(
        safe.code,
      ) ||
        safe.status >= 500)
    ) {
      uncertain(version);
      return;
    }
    const status: AdminState['status'] =
      safe.status === 401
        ? 'expired'
        : safe.status === 403
          ? 'denied'
          : safe.status === 404 || safe.status === 503
            ? 'unavailable'
            : safe.status === 429
              ? 'rate-limited'
              : safe.code === 'CANCELLED'
                ? 'anonymous'
                : 'error';
    update({ status, user: null, pending: false, message: safe.message });
  }
  function setAccess(raw: unknown, version: number) {
    check(version);
    const value = refreshSchema.safeParse(raw);
    if (!value.success) throw new AdminApiError('INVALID_RESPONSE');
    token = value.data.accessToken;
    expiresAt = now() + value.data.expiresInSeconds * 1000;
    clearTimeout(expiry);
    expiry = setTimeout(() => {
      expireIfNeeded();
    }, value.data.expiresInSeconds * 1000);
  }
  async function loadCurrent(version: number, expectedId?: string) {
    check(version);
    expireIfNeeded();
    check(version);
    if (!token) throw new AdminApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401);
    const current = await api.me(token, operationAbort?.signal);
    check(version);
    expireIfNeeded();
    check(version);
    const parsed = currentUserSchema.safeParse(current);
    if (!parsed.success) throw new AdminApiError('INVALID_RESPONSE');
    if (expectedId && parsed.data.id !== expectedId)
      throw new AdminApiError('INVALID_RESPONSE');
    const projected = projectAdmin(parsed.data);
    if (!projected) throw new AdminApiError('AUTH_FORBIDDEN', 403);
    accountId = projected.id;
    update({
      status: 'eligible',
      user: projected,
      pending: false,
      message: '',
    });
  }
  function single(work: () => Promise<void>) {
    if (flight) return flight;
    const next = Promise.resolve()
      .then(work)
      .catch(() => {
        // Unexpected collaborator failures must never retain privileged state.
        invalidate('uncertain', uncertainMessage);
      })
      .finally(() => {
        if (flight === next) flight = undefined;
      });
    flight = next;
    return next;
  }
  function begin() {
    const version = ++generation;
    operationAbort?.abort();
    operationAbort = new AbortController();
    clearAuthority();
    update({ status: 'checking', user: null, pending: true, message: '' });
    return version;
  }
  const receive = (message: AdminControl) => {
    invalidate(
      message === 'uncertain' ? 'uncertain' : 'anonymous',
      message === 'uncertain'
        ? uncertainMessage
        : message === 'identity-changed'
          ? 'The account changed. Sign in or explicitly restore the session.'
          : '',
    );
  };
  return {
    getSnapshot() {
      expireIfNeeded();
      return state;
    },
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    connect() {
      if (disposed || connected) return () => {};
      connected = true;
      try {
        stopListening = coordination.listen(receive);
        if (!coordination.supported()) throw new AdminCoordinationError();
      } catch {
        invalidate('unsupported', new AdminCoordinationError().message);
      }
      return () => {
        if (!connected) return;
        connected = false;
        stopListening?.();
        stopListening = undefined;
        invalidate('anonymous');
      };
    },
    login(email: string, password: string) {
      if (flight || loggingOut) return flight ?? Promise.resolve();
      if (!ready()) return Promise.resolve();
      const input = loginInput.safeParse({ email, password });
      if (!input.success) {
        invalidate('error', new AdminApiError('VALIDATION_ERROR').message);
        return Promise.resolve();
      }
      const version = begin();
      return single(async () => {
        let sent = false;
        try {
          await coordination.run(async () => {
            check(version);
            publish('identity-changed');
            check(version);
            sent = true;
            // Do not abort an admitted cookie mutation on local invalidation.
            // Keep its lock until its bounded request settles, then discard it.
            const raw = await api.login(input.data.email, input.data.password);
            check(version);
            const login = loginSchema.safeParse(raw);
            if (!login.success) throw new AdminApiError('INVALID_RESPONSE');
            if (login.data.user.role !== 'ADMIN')
              throw new AdminApiError('AUTH_FORBIDDEN', 403);
            setAccess(
              {
                accessToken: login.data.accessToken,
                expiresInSeconds: login.data.expiresInSeconds,
              },
              version,
            );
            await loadCurrent(version, login.data.user.id);
          }, operationAbort?.signal);
        } catch (error) {
          failure(error, version, sent);
        } finally {
          // Strings cannot be reliably zeroized; release the retained form reference.
          input.data.password = '';
          password = '';
        }
      });
    },
    restore() {
      if (flight || loggingOut) return flight ?? Promise.resolve();
      if (
        !ready() ||
        state.status === 'uncertain' ||
        state.status === 'eligible'
      )
        return Promise.resolve();
      const version = begin();
      return single(async () => {
        let sent = false;
        try {
          await coordination.run(async () => {
            check(version);
            publish('identity-changed');
            check(version);
            sent = true;
            const access = await api.refresh();
            check(version);
            setAccess(access, version);
            await loadCurrent(version);
          }, operationAbort?.signal);
        } catch (error) {
          failure(error, version, sent);
        }
      });
    },
    revalidate() {
      if (flight || loggingOut) return flight ?? Promise.resolve();
      if (!ready()) return Promise.resolve();
      expireIfNeeded();
      if (!token || !accountId) return Promise.resolve();
      const expectedId = accountId;
      const version = generation;
      operationAbort?.abort();
      operationAbort = new AbortController();
      update({ status: 'checking', user: null, pending: true, message: '' });
      return single(async () => {
        try {
          await coordination.run(
            () => loadCurrent(version, expectedId),
            operationAbort?.signal,
          );
        } catch (error) {
          failure(error, version, false);
        }
      });
    },
    suspend() {
      expireIfNeeded();
      if (flight) {
        invalidate('uncertain', uncertainMessage);
        if (connected) {
          try {
            publish('uncertain');
          } catch {
            /* Refused locally. */
          }
        }
      } else if (state.status === 'eligible') {
        generation++;
        operationAbort?.abort();
        update({ status: 'checking', user: null, pending: false, message: '' });
      }
    },
    cancel() {
      const wasPending = Boolean(flight);
      invalidate(
        wasPending ? 'uncertain' : 'anonymous',
        wasPending ? uncertainMessage : '',
      );
      if (connected && wasPending) {
        try {
          publish('uncertain');
        } catch {
          /* Already refused locally. */
        }
      }
    },
    logout() {
      if (loggingOut) return flight ?? Promise.resolve();
      if (!ready()) return Promise.resolve();
      loggingOut = true;
      const previous = flight;
      const version = begin();
      // Remove authority in other tabs before waiting for an admitted mutation.
      try {
        publish('uncertain');
      } catch {
        loggingOut = false;
        return Promise.resolve();
      }
      const next = Promise.resolve().then(async () => {
        try {
          await previous;
          check(version);
          await coordination.run(async () => {
            check(version);
            await api.logout();
            check(version);
            clearAuthority();
            update({
              status: 'anonymous',
              user: null,
              pending: false,
              message: '',
            });
            publish('signed-out');
          }, operationAbort?.signal);
        } catch (error) {
          if (generation === version && !disposed && error !== obsolete) {
            clearAuthority();
            if (error instanceof AdminCoordinationError)
              update({
                status: 'unsupported',
                user: null,
                pending: false,
                message: error.message,
              });
            else uncertain(version);
          }
        } finally {
          loggingOut = false;
          if (flight === next) flight = undefined;
        }
      });
      flight = next;
      return next;
    },
    invalidateSession(code: AdminErrorCode = 'AUTH_ACCESS_TOKEN_EXPIRED') {
      invalidate(
        code === 'AUTH_FORBIDDEN' ? 'denied' : 'expired',
        new AdminApiError(code).message,
      );
    },
    dispose() {
      disposed = true;
      connected = false;
      stopListening?.();
      stopListening = undefined;
      invalidate('anonymous');
      listeners.clear();
    },
  };
}
export type AdminController = ReturnType<typeof createAdminController>;
