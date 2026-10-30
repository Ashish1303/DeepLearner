import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createAdminController } from '../src/lib/auth/admin-controller';
import { AdminApiError, type AdminClient } from '../src/lib/auth/admin-client';
import type { CurrentUser } from '../src/lib/auth/contracts';
import {
  TechnologyError,
  createTechnologyClient,
  type TechnologyClient,
} from '../src/lib/technologies/technology-client';
import { createTechnologyController } from '../src/lib/technologies/technology-controller';
import {
  createAdminBrowserCoordination,
  AdminCoordinationError,
  type AdminControl,
  type AdminCoordination,
  type AdminCoordinationHost,
} from '../src/lib/auth/browser-coordination';

const user: CurrentUser = {
  id: 'a'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  plan: 'FREE',
  emailVerified: true,
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-29T00:00:00.000Z',
};
const token = 'synthetic-access';
const access = { accessToken: token, expiresInSeconds: 900 as const };
const login = {
  ...access,
  user: {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    status: 'ACTIVE' as const,
    plan: user.plan,
  },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function fixture(
  t: TestContext,
  overrides: Partial<AdminClient> = {},
  options: {
    supported?: boolean;
    now?: () => number;
    coordination?: AdminCoordination;
    technologies?: TechnologyClient;
  } = {},
) {
  const calls: string[] = [];
  const messages: AdminControl[] = [];
  let listener: ((message: AdminControl) => void) | undefined;
  let supported = options.supported ?? true;
  let queue = Promise.resolve();
  const coordination: AdminCoordination = options.coordination ?? {
    supported: () => supported,
    run(work, signal) {
      const result = queue.then(() => {
        if (signal?.aborted || !supported) throw new AdminCoordinationError();
        return work();
      });
      queue = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    publish(message) {
      if (!supported) throw new AdminCoordinationError();
      messages.push(message);
    },
    listen(fn) {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
  };
  const api: AdminClient = {
    async login() {
      calls.push('login');
      return login;
    },
    async refresh() {
      calls.push('refresh');
      return access;
    },
    async me() {
      calls.push('me');
      return user;
    },
    async logout() {
      calls.push('logout');
      return null;
    },
    ...overrides,
  };
  const controller = createAdminController(
    api,
    coordination,
    options.now,
    options.technologies,
  );
  const disconnect = controller.connect();
  t.after(() => controller.dispose());
  return {
    controller,
    api,
    calls,
    messages,
    disconnect,
    emit: (value: AdminControl) => listener?.(value),
    unsupported: () => {
      supported = false;
    },
  };
}
test('connect is passive and eligible sign-in needs current me, never login alone', async (t) => {
  const me = deferred<CurrentUser>();
  const f = fixture(t, { me: async () => me.promise });
  assert.equal(f.controller.getSnapshot().status, 'idle');
  assert.deepEqual(f.calls, []);
  const pending = f.controller.login(user.email, 'synthetic-password');
  await flush();
  assert.equal(f.controller.getSnapshot().status, 'checking');
  assert.equal(f.controller.getSnapshot().user, null);
  me.resolve(user);
  await pending;
  const state = f.controller.getSnapshot();
  assert.equal(state.status, 'eligible');
  assert.equal(state.user?.id, user.id);
  assert(Object.isFrozen(state) && Object.isFrozen(state.user));
  assert.deepEqual(f.calls, ['login']);
  assert.deepEqual(f.messages, ['identity-changed']);
  const serialized = JSON.stringify(state);
  for (const privateValue of [
    token,
    'synthetic-password',
    'authMethods',
    'profile',
    'createdAt',
    'plan',
  ])
    assert(!serialized.includes(privateValue));
});
test('Student login is denied without signing out its shared cookie', async (t) => {
  const f = fixture(t, {
    login: async () => ({ ...login, user: { ...login.user, role: 'STUDENT' } }),
  });
  await f.controller.login(user.email, 'synthetic-password');
  assert.equal(f.controller.getSnapshot().status, 'denied');
  assert.equal(f.controller.getSnapshot().user, null);
  assert.deepEqual(f.calls, []);
});
for (const [label, patch] of [
  ['student', { role: 'STUDENT' as const }],
  ['disabled', { status: 'DISABLED' as const }],
  ['suspended', { status: 'SUSPENDED' as const }],
  ['pending', { status: 'PENDING_VERIFICATION' as const }],
  ['unverified', { emailVerified: false }],
] as const)
  test('current account refuses ' + label, async (t) => {
    const f = fixture(t, { me: async () => ({ ...user, ...patch }) });
    await f.controller.login(user.email, 'synthetic-password');
    assert.equal(f.controller.getSnapshot().status, 'denied');
    assert.equal(f.controller.getSnapshot().user, null);
    assert(!f.calls.includes('logout'));
  });
for (const raw of [
  { ...user, id: undefined },
  { ...user, emailVerified: undefined },
  { ...user, passwordHash: 'PRIVATE' },
  null,
])
  test(
    'missing/malformed current identity fails closed ' +
      JSON.stringify(raw).slice(0, 70),
    async (t) => {
      const f = fixture(t, { me: async () => raw as unknown as CurrentUser });
      await f.controller.restore();
      assert.equal(f.controller.getSnapshot().status, 'uncertain');
      assert.equal(f.controller.getSnapshot().user, null);
      assert(!JSON.stringify(f.controller.getSnapshot()).includes('PRIVATE'));
    },
  );
test('login/current-user identity mismatch is never adopted', async (t) => {
  const f = fixture(t, { me: async () => ({ ...user, id: 'b'.repeat(24) }) });
  await f.controller.login(user.email, 'synthetic-password');
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('explicit restoration is single flight, no background or eligible-state rotation', async (t) => {
  const refresh = deferred<typeof access>();
  let calls = 0;
  const f = fixture(t, {
    refresh: async () => {
      calls++;
      return refresh.promise;
    },
  });
  const first = f.controller.restore();
  const second = f.controller.restore();
  assert.equal(first, second);
  await flush();
  assert.equal(calls, 1);
  refresh.resolve(access);
  await first;
  await f.controller.restore();
  assert.equal(calls, 1);
  assert.equal(f.controller.getSnapshot().status, 'eligible');
});
test('duplicate login does not submit a second credential pair', async (t) => {
  const response = deferred<typeof login>();
  let attempts = 0;
  const f = fixture(t, {
    login: async () => {
      attempts++;
      return response.promise;
    },
  });
  const first = f.controller.login(user.email, 'synthetic-password');
  assert.equal(
    first,
    f.controller.login('other@example.test', 'second-password'),
  );
  await flush();
  response.resolve(login);
  await first;
  assert.equal(attempts, 1);
});
for (const code of [
  'NETWORK_ERROR',
  'TIMEOUT',
  'INVALID_RESPONSE',
  'CANCELLED',
] as const)
  test(
    'ambiguous refresh is never automatically or explicitly replayed: ' + code,
    async (t) => {
      let calls = 0;
      const f = fixture(t, {
        refresh: async () => {
          calls++;
          throw new AdminApiError(code);
        },
      });
      await f.controller.restore();
      assert.equal(f.controller.getSnapshot().status, 'uncertain');
      await f.controller.restore();
      assert.equal(calls, 1);
      await f.controller.login(user.email, 'synthetic-password');
      assert.equal(f.controller.getSnapshot().status, 'eligible');
    },
  );
for (const [status, code, expected] of [
  [401, 'AUTH_REFRESH_TOKEN_REUSED', 'expired'],
  [403, 'AUTH_ACCOUNT_DISABLED', 'denied'],
  [404, 'USER_NOT_FOUND', 'unavailable'],
  [429, 'RATE_LIMIT_EXCEEDED', 'rate-limited'],
  [503, 'DEPENDENCY_UNAVAILABLE', 'uncertain'],
] as const)
  test('restoration safe failure ' + code, async (t) => {
    const f = fixture(t, {
      refresh: async () => {
        throw new AdminApiError(code, status);
      },
    });
    await f.controller.restore();
    assert.equal(f.controller.getSnapshot().status, expected);
    assert.equal(f.controller.getSnapshot().user, null);
  });
test('401 current eligibility never silently refreshes the session', async (t) => {
  const f = fixture(t, {
    me: async () => {
      throw new AdminApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401);
    },
  });
  await f.controller.login(user.email, 'synthetic-password');
  assert.equal(f.controller.getSnapshot().status, 'expired');
  assert(!f.calls.includes('refresh'));
});
test('unknown thrown details are never exposed', async (t) => {
  const f = fixture(t, {
    login: async () => {
      throw new Error('PRIVATE_EXCEPTION');
    },
  });
  await f.controller.login(user.email, 'synthetic-password');
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert(
    !JSON.stringify(f.controller.getSnapshot()).includes('PRIVATE_EXCEPTION'),
  );
});
test('cancel drains an admitted cookie mutation and refuses late eligibility', async (t) => {
  const response = deferred<typeof access>();
  let signalReceived: AbortSignal | undefined;
  const f = fixture(t, {
    refresh: async (signal) => {
      signalReceived = signal;
      return response.promise;
    },
  });
  const pending = f.controller.restore();
  await flush();
  f.controller.cancel();
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(signalReceived, undefined);
  const duplicate = f.controller.login(user.email, 'synthetic-password');
  assert.equal(duplicate, pending);
  response.resolve(access);
  await pending;
  assert.equal(f.controller.getSnapshot().user, null);
  assert(!f.calls.includes('me'));
});
test('logout hides authority immediately and waits for admitted refresh to settle', async (t) => {
  const response = deferred<typeof access>();
  const order: string[] = [];
  const f = fixture(t, {
    refresh: async () => {
      order.push('refresh-start');
      const result = await response.promise;
      order.push('refresh-end');
      return result;
    },
    logout: async () => {
      order.push('logout');
      return null;
    },
  });
  const restoration = f.controller.restore();
  await flush();
  const logout = f.controller.logout();
  assert.equal(f.controller.getSnapshot().user, null);
  assert.deepEqual(order, ['refresh-start']);
  assert.equal(logout, f.controller.logout());
  response.resolve(access);
  await Promise.all([restoration, logout]);
  assert.deepEqual(order, ['refresh-start', 'refresh-end', 'logout']);
  assert.equal(f.controller.getSnapshot().status, 'anonymous');
  assert(f.messages.includes('signed-out'));
});
for (const code of [
  'NETWORK_ERROR',
  'DEPENDENCY_UNAVAILABLE',
  'INVALID_RESPONSE',
] as const)
  test(
    'failed logout never restores privileged snapshot: ' + code,
    async (t) => {
      let logoutCalls = 0;
      const f = fixture(t, {
        logout: async () => {
          logoutCalls++;
          if (logoutCalls === 1) throw new AdminApiError(code, 503);
          return null;
        },
      });
      await f.controller.login(user.email, 'synthetic-password');
      await f.controller.logout();
      assert.equal(f.controller.getSnapshot().status, 'uncertain');
      assert.equal(f.controller.getSnapshot().user, null);
      assert(!f.messages.includes('signed-out'));
      await f.controller.restore();
      assert(!f.calls.includes('refresh'));
      await f.controller.logout();
      assert.equal(f.controller.getSnapshot().status, 'anonymous');
      assert.equal(logoutCalls, 2);
    },
  );
test('account switch invalidation discards late reads and obsolete errors', async (t) => {
  for (const fail of [false, true]) {
    const current = deferred<CurrentUser>();
    let reads = 0;
    const f = fixture(t, {
      me: async () =>
        ++reads === 1 ? current.promise : { ...user, id: 'b'.repeat(24) },
    });
    const first = f.controller.restore();
    await flush();
    f.emit('identity-changed');
    if (fail)
      current.reject(new AdminApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401));
    else current.resolve(user);
    await first;
    assert.equal(f.controller.getSnapshot().status, 'anonymous');
    await f.controller.restore();
    assert.equal(f.controller.getSnapshot().user?.id, 'b'.repeat(24));
  }
});
test('revalidation clears cached eligibility before reading and refuses changed account', async (t) => {
  let reads = 0;
  const next = deferred<CurrentUser>();
  const f = fixture(t, {
    me: async () => (++reads === 1 ? user : next.promise),
  });
  await f.controller.login(user.email, 'synthetic-password');
  const checking = f.controller.revalidate();
  assert.equal(f.controller.getSnapshot().status, 'checking');
  assert.equal(f.controller.getSnapshot().user, null);
  next.resolve({ ...user, id: 'b'.repeat(24) });
  await checking;
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('return from background requires current eligibility without refresh rotation', async (t) => {
  const f = fixture(t);
  await f.controller.login(user.email, 'synthetic-password');
  f.controller.suspend();
  assert.equal(f.controller.getSnapshot().status, 'checking');
  assert.equal(f.controller.getSnapshot().user, null);
  await f.controller.revalidate();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  assert.deepEqual(f.calls, ['login', 'me', 'me']);
});
test('backgrounding during eligibility read refuses a late authenticated result', async (t) => {
  const current = deferred<CurrentUser>();
  const f = fixture(t, { me: async () => current.promise });
  const pending = f.controller.restore();
  await flush();
  f.controller.suspend();
  current.resolve(user);
  await pending;
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('expiry invalidates subscribers even across suspend/revalidate generations', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const f = fixture(t, {}, { now: () => now });
  const statuses: string[] = [];
  f.controller.subscribe(() =>
    statuses.push(f.controller.getSnapshot().status),
  );
  await f.controller.login(user.email, 'synthetic-password');
  f.controller.suspend();
  await f.controller.revalidate();
  assert.equal(f.controller.getSnapshot().status, 'eligible');
  now = 900000;
  t.mock.timers.tick(900000);
  assert.equal(statuses.at(-1), 'expired');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('late timer callbacks cannot expose expired state on snapshot reads', async (t) => {
  let now = 0;
  const f = fixture(t, {}, { now: () => now });
  await f.controller.restore();
  now = 900001;
  assert.equal(f.controller.getSnapshot().status, 'expired');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('expiry during me response refuses eligibility', async (t) => {
  let now = 0;
  const f = fixture(
    t,
    {
      me: async () => {
        now = 900000;
        return user;
      },
    },
    { now: () => now },
  );
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'expired');
});
test('disconnect/dispose aborts current reads and prevents any late resurrection', async (t) => {
  for (const dispose of [false, true]) {
    const current = deferred<CurrentUser>();
    let signal: AbortSignal | undefined;
    const f = fixture(t, {
      me: async (_token, value) => {
        signal = value;
        return current.promise;
      },
    });
    const pending = f.controller.restore();
    await flush();
    if (dispose) f.controller.dispose();
    else f.disconnect();
    assert(signal?.aborted);
    current.resolve(user);
    await pending;
    assert.equal(f.controller.getSnapshot().user, null);
    assert.equal(f.controller.getSnapshot().status, 'anonymous');
    if (dispose) {
      await f.controller.login(user.email, 'synthetic-password');
      assert.notEqual(f.controller.getSnapshot().status, 'eligible');
    }
  }
});
test('unsupported coordination refuses before submitting credentials or cookies', async (t) => {
  const f = fixture(t, {}, { supported: false });
  await f.controller.login(user.email, 'synthetic-password');
  await f.controller.restore();
  await f.controller.logout();
  assert.deepEqual(f.calls, []);
  assert.equal(f.controller.getSnapshot().status, 'unsupported');
});
test('unconnected controller cannot acquire authority', async () => {
  const api = {} as AdminClient;
  const coordination = { supported: () => true } as AdminCoordination;
  const c = createAdminController(api, coordination);
  await c.restore();
  assert.equal(c.getSnapshot().status, 'unsupported');
  c.dispose();
});
test('broadcast errors refuse before mutation and unknown controls never carry secrets', async (t) => {
  const coordination: AdminCoordination = {
    supported: () => true,
    run: async (work) => work(),
    publish() {
      throw new Error('PRIVATE_CHANNEL');
    },
    listen: () => () => {},
  };
  const f = fixture(t, {}, { coordination });
  await f.controller.login(user.email, 'synthetic-password');
  assert.deepEqual(f.calls, []);
  assert.equal(f.controller.getSnapshot().user, null);
  assert(!f.controller.getSnapshot().message.includes('PRIVATE_CHANNEL'));
});
test('two controllers serialize restore and invalidate queued stale account actions', async (t) => {
  let queue = Promise.resolve();
  const receivers = new Map<number, (message: AdminControl) => void>();
  let nextId = 0;
  const endpoint = (): AdminCoordination => {
    const id = nextId++;
    return {
      supported: () => true,
      run(work, signal) {
        const result = queue.then(() => {
          if (signal?.aborted) throw new AdminCoordinationError();
          return work();
        });
        queue = result.then(
          () => {},
          () => {},
        );
        return result;
      },
      publish(message) {
        for (const [other, listener] of receivers)
          if (other !== id) listener(message);
      },
      listen(fn) {
        receivers.set(id, fn);
        return () => {
          receivers.delete(id);
        };
      },
    };
  };
  let refreshes = 0;
  const refresh = async () => {
    refreshes++;
    return access;
  };
  const a = fixture(t, { refresh }, { coordination: endpoint() });
  const b = fixture(t, { refresh }, { coordination: endpoint() });
  await Promise.all([a.controller.restore(), b.controller.restore()]);
  assert.equal(refreshes, 1);
  assert.equal(a.controller.getSnapshot().status, 'eligible');
  assert.equal(b.controller.getSnapshot().user, null);
  await b.controller.restore();
  assert.equal(refreshes, 2);
  assert.equal(a.controller.getSnapshot().user, null);
  assert.equal(b.controller.getSnapshot().status, 'eligible');
});

function browserFixture(
  overrides: {
    noLock?: boolean;
    noChannel?: boolean;
    insecure?: boolean;
    channelFailure?: boolean;
    publishFailure?: boolean;
  } = {},
) {
  const sent: unknown[] = [];
  const requests: { name: string; options: LockOptions }[] = [];
  let receiver: ((event: MessageEvent<unknown>) => void) | null = null;
  let onError: (() => void) | null = null;
  let closed = 0;
  let active = 0;
  let maximum = 0;
  let queue = Promise.resolve();
  class Channel {
    constructor(name: string) {
      assert.equal(name, 'deeplearner-auth');
      if (overrides.channelFailure) throw new Error('PRIVATE_CHANNEL');
    }
    set onmessage(value: typeof receiver) {
      receiver = value;
    }
    set onmessageerror(value: typeof onError) {
      onError = value;
    }
    postMessage(value: unknown) {
      if (overrides.publishFailure) throw new Error('PRIVATE_CHANNEL');
      sent.push(value);
    }
    close() {
      closed++;
    }
  }
  const request = (
    name: string,
    options: LockOptions,
    work: (lock: Lock) => Promise<unknown>,
  ) => {
    requests.push({ name, options });
    const result = queue.then(async () => {
      active++;
      maximum = Math.max(maximum, active);
      try {
        return await work({ name, mode: 'exclusive' });
      } finally {
        active--;
      }
    });
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  const host: AdminCoordinationHost = {
    isSecureContext: !overrides.insecure,
    navigator: overrides.noLock
      ? {}
      : { locks: { request: request as LockManager['request'] } },
    ...(overrides.noChannel
      ? {}
      : { BroadcastChannel: Channel as unknown as typeof BroadcastChannel }),
  };
  const coordination = createAdminBrowserCoordination(() => host);
  return {
    coordination,
    requests,
    sent,
    host,
    receive: (data: unknown) => receiver?.({ data } as MessageEvent<unknown>),
    error: () => onError?.(),
    closed: () => closed,
    maximum: () => maximum,
  };
}
test('browser coordinator holds a single named exclusive lock until admitted work drains', async () => {
  const f = browserFixture();
  const disconnect = f.coordination.listen(() => {});
  const gate = deferred<void>();
  const order: string[] = [];
  const first = f.coordination.run(async () => {
    order.push('start');
    await gate.promise;
    order.push('end');
  });
  const second = f.coordination.run(async () => {
    order.push('second');
  });
  await flush();
  assert.deepEqual(order, ['start']);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['start', 'end', 'second']);
  assert.equal(f.maximum(), 1);
  assert(
    f.requests.every(
      (x) =>
        x.name === 'deeplearner-auth' &&
        x.options.mode === 'exclusive' &&
        x.options.signal,
    ),
  );
  disconnect();
  assert.equal(f.closed(), 1);
});
for (const options of [
  { noLock: true },
  { noChannel: true },
  { insecure: true },
  { channelFailure: true },
])
  test(
    'unsupported browser context fails closed ' + JSON.stringify(options),
    async () => {
      const f = browserFixture(options);
      const controls: AdminControl[] = [];
      const stop = f.coordination.listen((value) => controls.push(value));
      let called = false;
      await assert.rejects(
        f.coordination.run(async () => {
          called = true;
        }),
        AdminCoordinationError,
      );
      assert(!called);
      assert(!f.coordination.supported());
      assert(controls.includes('uncertain'));
      stop();
    },
  );
test('channel allowlists fixed controls and closes after last subscriber', () => {
  const f = browserFixture();
  const received: AdminControl[] = [];
  const stop = f.coordination.listen((value) => received.push(value));
  const stop2 = f.coordination.listen(() => {});
  for (const value of [
    'identity-changed',
    'signed-out',
    'uncertain',
    'PRIVATE',
    null,
    { accessToken: token },
  ])
    f.receive(value);
  assert.deepEqual(received, ['identity-changed', 'signed-out', 'uncertain']);
  f.coordination.publish('signed-out');
  assert.deepEqual(f.sent, ['signed-out']);
  assert.throws(
    () =>
      f.coordination.publish({ accessToken: token } as unknown as AdminControl),
    AdminCoordinationError,
  );
  stop();
  assert.equal(f.closed(), 0);
  stop2();
  assert.equal(f.closed(), 1);
  assert.throws(
    () => f.coordination.publish('signed-out'),
    AdminCoordinationError,
  );
});
test('channel delivery error and publish failure invalidate compatibility', () => {
  for (const publishFailure of [false, true]) {
    const f = browserFixture({ publishFailure });
    const received: AdminControl[] = [];
    const stop = f.coordination.listen((value) => received.push(value));
    if (publishFailure)
      assert.throws(
        () => f.coordination.publish('signed-out'),
        AdminCoordinationError,
      );
    else f.error();
    assert.deepEqual(received, ['uncertain']);
    assert(!f.coordination.supported());
    stop();
  }
});
test('admitted application errors retain their safe category rather than becoming lock failures', async () => {
  const f = browserFixture();
  const stop = f.coordination.listen(() => {});
  await assert.rejects(
    f.coordination.run(async () => {
      throw new AdminApiError('AUTH_FORBIDDEN', 403);
    }),
    { code: 'AUTH_FORBIDDEN' },
  );
  stop();
});
test('lock acquisition deadline and cancellation refuse delayed admission', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = browserFixture();
  const stop = f.coordination.listen(() => {});
  const gate = deferred<void>();
  const first = f.coordination.run(async () => gate.promise);
  await flush();
  let called = false;
  const second = f.coordination.run(async () => {
    called = true;
  });
  t.mock.timers.tick(20000);
  gate.resolve();
  await first;
  await assert.rejects(second, AdminCoordinationError);
  assert(!called);
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    f.coordination.run(async () => {
      called = true;
    }, abort.signal),
    AdminCoordinationError,
  );
  assert(!called);
  stop();
});

const technologyRecord = {
  id: 'd'.repeat(24),
  name: 'Draft',
  slug: 'draft',
  description: null,
  iconAssetId: null,
  status: 'DRAFT' as const,
  order: 0,
  revision: 0,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const technologyOperation = {
  kind: 'detail' as const,
  id: technologyRecord.id,
};
test('restricted business capability keeps token private and rejects caller-controlled transport', async (t) => {
  let calls = 0;
  const f = fixture(
    t,
    {},
    {
      technologies: {
        async execute(request, bearer, signal) {
          calls++;
          assert.deepEqual(request, technologyOperation);
          assert.equal(bearer, token);
          assert(!signal.aborted);
          return technologyRecord;
        },
      },
    },
  );
  await f.controller.login(user.email, 'synthetic-password');
  await f.controller.requestTechnology(user.id, technologyOperation);
  await assert.rejects(
    f.controller.requestTechnology(user.id, {
      ...technologyOperation,
      url: 'https://evil.test',
    } as never),
    TechnologyError,
  );
  await assert.rejects(
    f.controller.requestTechnology('b'.repeat(24), technologyOperation),
    TechnologyError,
  );
  assert.equal(calls, 1);
  assert(!JSON.stringify(f.controller.getSnapshot()).includes(token));
  assert(!('getAccessToken' in f.controller));
});
for (const code of [401, 403])
  test('business ' + code + ' removes Admin authority', async (t) => {
    const f = fixture(
      t,
      {},
      {
        technologies: {
          async execute() {
            throw new TechnologyError(
              code === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN',
              code,
            );
          },
        },
      },
    );
    await f.controller.login(user.email, 'synthetic-password');
    await assert.rejects(
      f.controller.requestTechnology(user.id, technologyOperation),
      TechnologyError,
    );
    assert.equal(
      f.controller.getSnapshot().status,
      code === 401 ? 'expired' : 'denied',
    );
    assert.equal(f.controller.getSnapshot().user, null);
  });
for (const action of [
  'suspend',
  'cancel',
  'cross-account',
  'disconnect',
] as const)
  test('business response refused after ' + action, async (t) => {
    const wait = deferred<typeof technologyRecord>();
    let signal: AbortSignal | undefined;
    const f = fixture(
      t,
      {},
      {
        technologies: {
          async execute(_r, _t, s) {
            signal = s;
            return wait.promise;
          },
        },
      },
    );
    await f.controller.login(user.email, 'synthetic-password');
    const pending = f.controller.requestTechnology(
      user.id,
      technologyOperation,
    );
    const checked = assert.rejects(pending, TechnologyError);
    await flush();
    if (action === 'cross-account') f.emit('identity-changed');
    else if (action === 'disconnect') f.disconnect();
    else f.controller[action]();
    assert(signal?.aborted);
    wait.resolve(technologyRecord);
    await checked;
    assert.notEqual(f.controller.getSnapshot().status, 'eligible');
  });
test('whole-operation monotonic budget includes coordination queueing without deadline renewal', async (t) => {
  let now = 0,
    held = false;
  const queue = deferred<void>();
  let calls = 0;
  const coordination: AdminCoordination = {
    supported: () => true,
    listen: () => () => {},
    publish() {},
    async run(work, signal) {
      if (held) await queue.promise;
      if (signal?.aborted) throw new AdminCoordinationError();
      return work();
    },
  };
  const f = fixture(
    t,
    {},
    {
      now: () => now,
      coordination,
      technologies: {
        async execute() {
          calls++;
          return technologyRecord;
        },
      },
    },
  );
  await f.controller.login(user.email, 'synthetic-password');
  held = true;
  const pending = f.controller.requestTechnology(user.id, technologyOperation);
  const checked = assert.rejects(
    pending,
    (e: unknown) => e instanceof TechnologyError && e.code === 'TIMEOUT',
  );
  await flush();
  now = 15001;
  queue.resolve();
  await checked;
  assert.equal(calls, 0);
});
test('business timeout cannot dispatch after a delayed lock callback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let held = false,
    calls = 0;
  const queue = deferred<void>();
  const coordination: AdminCoordination = {
    supported: () => true,
    listen: () => () => {},
    publish() {},
    async run(work) {
      if (held) await queue.promise;
      return work();
    },
  };
  const f = fixture(
    t,
    {},
    {
      coordination,
      technologies: {
        async execute() {
          calls++;
          return technologyRecord;
        },
      },
    },
  );
  await f.controller.login(user.email, 'synthetic-password');
  held = true;
  const pending = f.controller.requestTechnology(user.id, technologyOperation);
  const checked = assert.rejects(pending, TechnologyError);
  await flush();
  t.mock.timers.tick(15000);
  await checked;
  queue.resolve();
  await flush();
  assert.equal(calls, 0);
});
test('logout invalidates a business request immediately but waits for admitted transport settlement', async (t) => {
  const wait = deferred<typeof technologyRecord>();
  const f = fixture(
    t,
    {},
    {
      technologies: {
        async execute() {
          return wait.promise;
        },
      },
    },
  );
  await f.controller.login(user.email, 'synthetic-password');
  const pending = f.controller.requestTechnology(user.id, technologyOperation);
  const checked = assert.rejects(pending, TechnologyError);
  await flush();
  const logout = f.controller.logout();
  await flush();
  assert(!f.calls.includes('logout'));
  assert.equal(f.controller.getSnapshot().user, null);
  wait.resolve(technologyRecord);
  await checked;
  await logout;
  assert(f.calls.includes('logout'));
});

for (const status of [401, 403])
  test(
    'malformed HTTP ' + status + ' body still removes authority',
    async (t) => {
      const technologies = createTechnologyClient(
        'http://localhost:4000/api/v1',
        async () => new Response('SYNTHETIC_PRIVATE_NOT_JSON', { status }),
      );
      const f = fixture(t, {}, { technologies });
      await f.controller.login(user.email, 'synthetic-password');
      await assert.rejects(
        f.controller.requestTechnology(user.id, technologyOperation),
        TechnologyError,
      );
      assert.equal(f.controller.getSnapshot().user, null);
      assert.equal(
        f.controller.getSnapshot().status,
        status === 401 ? 'expired' : 'denied',
      );
    },
  );
test('suspend during mutation retains only uncertainty through revalidation and Technology-controller remount', async (t) => {
  const wait = deferred<typeof technologyRecord>();
  let writes = 0,
    reads = 0;
  const f = fixture(
    t,
    {},
    {
      technologies: {
        async execute(request) {
          if (request.kind === 'create') {
            writes++;
            return wait.promise;
          }
          reads++;
          return {
            items: [technologyRecord],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          };
        },
      },
    },
  );
  await f.controller.login(user.email, 'synthetic-password');
  const first = createTechnologyController(f.controller, user.id);
  first.connect();
  const pending = first.create({ name: 'Draft', slug: 'draft' });
  await flush();
  f.controller.suspend();
  first.dispose();
  wait.resolve(technologyRecord);
  await pending;
  await flush();
  await f.controller.revalidate();
  const second = createTechnologyController(f.controller, user.id);
  second.connect();
  t.after(() => second.dispose());
  assert(second.getSnapshot().needsReconciliation);
  assert.equal(second.getSnapshot().detail, null);
  assert.equal(reads, 0);
  assert.equal(writes, 1);
  await second.create({ name: 'Other', slug: 'other' });
  assert.equal(writes, 1);
  await second.list();
  assert.equal(reads, 1);
  assert(!second.getSnapshot().needsReconciliation);
  assert(!f.controller.hasTechnologyUncertainty());
});
