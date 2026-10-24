import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDashboardController } from '../src/lib/dashboard/dashboard-controller';
import {
  dashboardData,
  type DashboardData,
} from '../src/lib/dashboard/contracts';
import {
  createDashboardClient,
  DashboardError,
  type DashboardClient,
} from '../src/lib/api/dashboard-client';
import {
  createAuthController,
  type AuthController,
  type AuthState,
} from '../src/lib/auth/auth-controller';
import type { CurrentUser } from '../src/lib/api/contracts';
import { ApiError, type ApiClient } from '../src/lib/api/client';
import type {
  Control,
  Coordination,
} from '../src/lib/auth/browser-coordination';

const id = (n: number) => n.toString(16).padStart(24, '0');
const account = id(100);
const user: CurrentUser = {
  id: account,
  firstName: 'Synthetic',
  lastName: 'Student',
  email: 'student@example.invalid',
  role: 'STUDENT',
  status: 'ACTIVE',
  emailVerified: true,
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-24T00:00:00.000Z',
};
function page(start = 1, count = 5, more = true): DashboardData {
  const items = Array.from({ length: count }, (_, i) => {
    const conceptId = id(start + i),
      at = '2026-10-24T00:00:00.000Z';
    return {
      concept: {
        id: conceptId,
        title: 'Concept',
        slug: 'concept',
        difficulty: 'BEGINNER',
      },
      activity: {
        conceptId,
        status: 'IN_PROGRESS',
        attemptCount: 1,
        startedAt: at,
        lastActivityAt: at,
      },
      mastery: {
        status: 'UNAVAILABLE',
        result: null,
        unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
      },
    };
  });
  return dashboardData.parse({
    items,
    pagination: {
      limit: 5,
      nextCursor: more && count === 5 ? id(start + count - 1) : null,
    },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
function fixture(
  client: DashboardClient = {
    async load() {
      return page();
    },
  },
) {
  let state: AuthState = {
    status: 'authenticated',
    user: { ...user },
    pending: false,
    message: '',
  };
  const listeners = new Set<() => void>();
  let reads = 0;
  const auth: Pick<
    AuthController,
    'runAuthenticatedRead' | 'getSnapshot' | 'subscribe'
  > = {
    getSnapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    async runAuthenticatedRead(expected, signal, work) {
      assert.equal(expected, account);
      reads++;
      signal.throwIfAborted();
      const result = await work('synthetic-token', signal);
      signal.throwIfAborted();
      return result;
    },
  };
  return {
    controller: createDashboardController(client, auth, account),
    auth,
    reads: () => reads,
    listenerCount: () => listeners.size,
    change(patch: Partial<AuthState>) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn());
    },
  };
}

test('load, Next, retry and first/refresh replace bounded pages without cumulative data', async () => {
  const cursors: (string | null)[] = [];
  let failNext = true;
  const f = fixture({
    async load(cursor) {
      cursors.push(cursor);
      if (cursor && failNext) {
        failNext = false;
        throw new DashboardError('unavailable');
      }
      return cursor ? page(6) : page();
    },
  });
  assert.equal(f.controller.getSnapshot().status, 'idle');
  const initial = f.controller.load();
  assert.equal(f.controller.getSnapshot().status, 'loading');
  await initial;
  assert.deepEqual(f.controller.getSnapshot().data, page());
  const next = f.controller.next();
  assert.equal(f.controller.getSnapshot().data, null);
  await next;
  assert.equal(f.controller.getSnapshot().status, 'unavailable');
  assert.equal(f.controller.getSnapshot().data, null);
  await f.controller.retry();
  assert.deepEqual(f.controller.getSnapshot().data, page(6));
  assert.equal(f.controller.getSnapshot().data?.items.length, 5);
  await f.controller.first();
  await f.controller.next();
  await f.controller.refresh();
  assert.equal(f.controller.getSnapshot().cursor, null);
  assert.deepEqual(cursors, [null, id(5), id(5), null, id(5), null]);
  f.controller.cancel();
});

test('exact in-flight duplicate load/Next/retry shares one promise and one request', async () => {
  const held = deferred<DashboardData>();
  let calls = 0;
  const f = fixture({
    async load() {
      calls++;
      return held.promise;
    },
  });
  const pending = f.controller.load();
  assert.equal(f.controller.load(), pending);
  assert.equal(f.controller.next(), pending);
  assert.equal(f.controller.retry(), pending);
  await Promise.resolve();
  assert.equal(calls, 1);
  held.resolve(page());
  await pending;
  f.controller.cancel();
});

test('empty ready and exhausted continuation never initiate automatic requests', async () => {
  let calls = 0;
  const f = fixture({
    async load() {
      calls++;
      return page(1, 0, false);
    },
  });
  await f.controller.next();
  assert.equal(calls, 0);
  await f.controller.load();
  assert.equal(f.controller.getSnapshot().status, 'ready');
  assert.deepEqual(f.controller.getSnapshot().data?.items, []);
  await f.controller.next();
  assert.equal(calls, 1);
  f.controller.cancel();
});

for (const fails of [false, true]) {
  test(
    'superseded page ' +
      (fails ? 'failure' : 'success') +
      ' cannot overwrite fresh first page',
    async () => {
      const held = deferred<DashboardData>();
      let oldSignal: AbortSignal | undefined;
      const f = fixture({
        async load(cursor, _token, signal) {
          if (cursor) {
            oldSignal = signal;
            return held.promise;
          }
          return page();
        },
      });
      await f.controller.load();
      const old = f.controller.next();
      await Promise.resolve();
      await f.controller.refresh();
      assert(oldSignal?.aborted);
      if (fails) held.reject(Error('PRIVATE old error'));
      else held.resolve(page(6));
      await old;
      assert.deepEqual(f.controller.getSnapshot().data, page());
      f.controller.cancel();
    },
  );
}

for (const [kind, status] of [
  ['denied', 403],
  ['unavailable', 404],
  ['unavailable', 503],
  ['rate-limited', 429],
  ['error', 500],
] as const) {
  test(
    'safe ' + status + ' state is not empty; manual retry alone sends again',
    async () => {
      let calls = 0;
      const f = fixture({
        async load() {
          calls++;
          if (calls === 1)
            throw new DashboardError(kind, 'REQUEST_FAILED', status);
          return page();
        },
      });
      await f.controller.load();
      assert.equal(f.controller.getSnapshot().status, kind);
      assert.equal(f.controller.getSnapshot().data, null);
      assert.equal(calls, 1);
      await f.controller.retry();
      assert.equal(calls, 2);
      assert.equal(f.controller.getSnapshot().status, 'ready');
      f.controller.cancel();
    },
  );
}

test('malformed dependency result and private thrown errors are never reflected in state', async () => {
  for (const raw of [{ ...page(), answer: 'PRIVATE' }, page(1, 1, true)]) {
    const f = fixture({
      async load() {
        return raw as DashboardData;
      },
    });
    // The second fixture is valid, so force an invalid continuation explicitly.
    raw.pagination.nextCursor = id(100);
    await f.controller.load();
    assert.equal(f.controller.getSnapshot().status, 'error');
    assert(!JSON.stringify(f.controller.getSnapshot()).includes('PRIVATE'));
    f.controller.cancel();
  }
  const f = fixture({
    async load() {
      throw Error('PRIVATE token/answer');
    },
  });
  await f.controller.load();
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert(!JSON.stringify(f.controller.getSnapshot()).includes('PRIVATE'));
  f.controller.cancel();
});

test('backward/repeated cursor returned for Next refuses without further automatic traversal', async () => {
  let calls = 0;
  const f = fixture({
    async load() {
      calls++;
      return page();
    },
  });
  await f.controller.load();
  await f.controller.next();
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert.equal(f.controller.getSnapshot().data, null);
  assert.equal(calls, 2);
  f.controller.cancel();
});

for (const [name, patch] of [
  ['account switch', { user: { ...user, id: id(101) } }],
  ['anonymous', { status: 'anonymous', user: null }],
  ['pending operation', { pending: true }],
  ['Admin', { user: { ...user, role: 'ADMIN' } }],
  ['inactive', { user: { ...user, status: 'SUSPENDED' } }],
  ['unverified', { user: { ...user, emailVerified: false } }],
  ['uncertain', { status: 'uncertain', user: null }],
] as [string, Partial<AuthState>][]) {
  test(
    name + ' erases loaded data and blocks new reads for the old account',
    async () => {
      const f = fixture();
      await f.controller.load();
      assert(f.controller.getSnapshot().data);
      f.change(patch);
      assert.equal(f.controller.getSnapshot().status, 'denied');
      assert.equal(f.controller.getSnapshot().data, null);
      await f.controller.load();
      assert.equal(f.reads(), 1);
      f.controller.cancel();
    },
  );
}

test('account switch during a held response aborts it and refuses late disclosure', async () => {
  const held = deferred<DashboardData>();
  let signal: AbortSignal | undefined;
  const f = fixture({
    async load(_cursor, _token, s) {
      signal = s;
      return held.promise;
    },
  });
  const pending = f.controller.load();
  await Promise.resolve();
  f.change({ user: { ...user, id: id(101) } });
  assert(signal?.aborted);
  held.resolve(page());
  await pending;
  assert.equal(f.controller.getSnapshot().data, null);
  assert.equal(f.controller.getSnapshot().status, 'denied');
  f.controller.cancel();
});

test('cancel releases auth subscription and pending work; explicit remount load subscribes again', async () => {
  const held = deferred<DashboardData>();
  let calls = 0,
    signal: AbortSignal | undefined;
  const f = fixture({
    async load(_cursor, _token, s) {
      calls++;
      signal = s;
      return calls === 1 ? held.promise : page();
    },
  });
  const pending = f.controller.load();
  await Promise.resolve();
  assert.equal(f.listenerCount(), 1);
  f.controller.cancel();
  assert(signal?.aborted);
  assert.equal(f.listenerCount(), 0);
  held.resolve(page());
  await pending;
  assert.equal(f.controller.getSnapshot().status, 'idle');
  assert.equal(f.controller.getSnapshot().data, null);
  await f.controller.load();
  assert.equal(f.listenerCount(), 1);
  assert.equal(calls, 2);
  f.controller.cancel();
  assert.equal(f.listenerCount(), 0);
});

test('invalid account identity refuses locally and subscriber cleanup stops notifications', async () => {
  const f = fixture();
  const controller = createDashboardController(
    {
      async load() {
        throw Error('must not send');
      },
    },
    f.auth,
    'bad',
  );
  let changes = 0;
  const remove = controller.subscribe(() => {
    changes++;
  });
  await controller.load();
  assert.equal(controller.getSnapshot().status, 'denied');
  remove();
  const before = changes;
  controller.cancel();
  assert.equal(changes, before);
  f.controller.cancel();
});

test('existing real AuthController handles 401 without Dashboard refresh/replay and cross-tab invalidation clears data', async () => {
  let control: ((message: Control) => void) | undefined;
  const coordination: Coordination = {
    supported: () => true,
    async run(work) {
      return work();
    },
    publish() {},
    listen(fn) {
      control = fn;
      return () => {};
    },
  };
  let refreshes = 0;
  const api: ApiClient = {
    async login() {
      return { accessToken: 'synthetic-token', expiresInSeconds: 900 };
    },
    async refresh() {
      refreshes++;
      throw Error('unexpected refresh');
    },
    async me() {
      return user;
    },
    async logout() {
      return null;
    },
    async patchProfile() {
      return user;
    },
  };
  const auth = createAuthController(api, coordination);
  const disconnect = auth.connect();
  await auth.login('student@example.invalid', 'synthetic-private');
  let requests = 0;
  const client = createDashboardClient(
    'https://example.invalid/api/v1',
    async () => {
      requests++;
      return Response.json(
        {
          success: false,
          error: { code: 'AUTH_ACCESS_TOKEN_EXPIRED', message: 'PRIVATE' },
          meta: { requestId: 'r' },
        },
        { status: 401 },
      );
    },
  );
  const controller = createDashboardController(client, auth, account);
  await controller.load();
  assert.equal(auth.getSnapshot().status, 'anonymous');
  assert.equal(controller.getSnapshot().status, 'denied');
  assert.equal(controller.getSnapshot().data, null);
  assert.equal(requests, 1);
  assert.equal(refreshes, 0);
  await auth.login('student@example.invalid', 'synthetic-private');
  const other = createDashboardController(
    {
      async load() {
        return page();
      },
    },
    auth,
    account,
  );
  await other.load();
  assert(other.getSnapshot().data);
  control?.('signed-out');
  assert.equal(other.getSnapshot().data, null);
  other.cancel();
  controller.cancel();
  disconnect();
});

test('authentication refusal before operation sends no client request', async () => {
  const f = fixture();
  let sends = 0;
  const auth = {
    ...f.auth,
    async runAuthenticatedRead<T>(): Promise<T> {
      throw new ApiError('AUTH_ACCESS_TOKEN_INVALID', 401);
    },
  };
  const controller = createDashboardController(
    {
      async load() {
        sends++;
        return page();
      },
    },
    auth,
    account,
  );
  await controller.load();
  assert.equal(sends, 0);
  assert.equal(controller.getSnapshot().status, 'denied');
  controller.cancel();
});

test('uncertain auth snapshot or subscription fails closed before any request', async () => {
  const f = fixture();
  let sends = 0;
  for (const failure of ['snapshot', 'subscription']) {
    const auth = {
      ...f.auth,
      getSnapshot() {
        if (failure === 'snapshot') throw Error('PRIVATE auth error');
        return f.auth.getSnapshot();
      },
      subscribe(fn: () => void) {
        if (failure === 'subscription') throw Error('PRIVATE subscribe error');
        return f.auth.subscribe(fn);
      },
    };
    const controller = createDashboardController(
      {
        async load() {
          sends++;
          return page();
        },
      },
      auth,
      account,
    );
    await controller.load();
    assert.equal(controller.getSnapshot().status, 'denied');
    assert.equal(controller.getSnapshot().data, null);
    assert(!JSON.stringify(controller.getSnapshot()).includes('PRIVATE'));
    controller.cancel();
  }
  assert.equal(sends, 0);
});

test('loss of readable auth state clears an already displayed page synchronously', async () => {
  const f = fixture();
  let uncertain = false;
  const auth = {
    ...f.auth,
    getSnapshot() {
      if (uncertain) throw Error('PRIVATE');
      return f.auth.getSnapshot();
    },
  };
  const controller = createDashboardController(
    {
      async load() {
        return page();
      },
    },
    auth,
    account,
  );
  await controller.load();
  assert(controller.getSnapshot().data);
  uncertain = true;
  f.change({ pending: false });
  assert.equal(controller.getSnapshot().data, null);
  assert.equal(controller.getSnapshot().status, 'denied');
  controller.cancel();
});

test('failure-path account recheck erases the cursor even without an auth notification', async () => {
  const f = fixture();
  let current = f.auth.getSnapshot();
  const held = deferred<DashboardData>();
  const auth = { ...f.auth, getSnapshot: () => current };
  const controller = createDashboardController(
    {
      async load(cursor) {
        return cursor ? held.promise : page();
      },
    },
    auth,
    account,
  );
  await controller.load();
  const pending = controller.next();
  await Promise.resolve();
  current = { ...current, user: { ...user, id: id(101) } };
  held.reject(Error('PRIVATE failure'));
  await pending;
  assert.deepEqual(controller.getSnapshot(), {
    status: 'denied',
    data: null,
    cursor: null,
    message: 'Dashboard activity is not available for this account.',
  });
  controller.cancel();
});
