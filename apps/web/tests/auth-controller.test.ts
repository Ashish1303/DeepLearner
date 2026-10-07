import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAuthController } from '../src/lib/auth/auth-controller';
import { ApiError, type ApiClient } from '../src/lib/api/client';
import type { CurrentUser } from '../src/lib/api/contracts';
import type {
  Control,
  Coordination,
} from '../src/lib/auth/browser-coordination';

const user: CurrentUser = {
  id: 'a'.repeat(24),
  firstName: 'Test',
  lastName: 'Student',
  email: 'test@example.com',
  emailVerified: true,
  status: 'ACTIVE',
  role: 'STUDENT',
  plan: 'FREE',
  authMethods: ['PASSWORD'],
  profile: null,
  createdAt: '2026-10-06T00:00:00.000Z',
};
const access = {
  accessToken: 'synthetic-secret-access',
  expiresInSeconds: 900 as const,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(overrides: Partial<ApiClient> = {}, supported = true) {
  const calls: string[] = [];
  const messages: Control[] = [];
  let listener: ((message: Control) => void) | undefined;
  let queue = Promise.resolve();
  const coordination: Coordination = {
    supported: () => supported,
    run(work) {
      const result = queue.then(work);
      queue = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    publish(message) {
      messages.push(message);
    },
    listen(fn) {
      listener = fn;
      return () => {
        listener = undefined;
      };
    },
  };
  const api: ApiClient = {
    async login() {
      calls.push('login');
      return access;
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
  const controller = createAuthController(api, coordination);
  controller.connect();
  return {
    controller,
    calls,
    messages,
    emit: (message: Control) => listener?.(message),
  };
}
test('bootstrap is single-flight and private account state follows authoritative me only', async () => {
  const gate = deferred<typeof access>();
  let refreshes = 0;
  const f = fixture({
    refresh: async () => {
      refreshes++;
      return gate.promise;
    },
  });
  const first = f.controller.restore();
  const second = f.controller.restore();
  assert.equal(first, second);
  assert.equal(f.controller.getSnapshot().user, null);
  gate.resolve(access);
  await first;
  assert.equal(refreshes, 1);
  assert.equal(f.controller.getSnapshot().status, 'authenticated');
  assert.deepEqual(f.controller.getSnapshot().user, user);
  assert(
    !JSON.stringify(f.controller.getSnapshot()).includes(access.accessToken),
  );
  await f.controller.restore();
  assert.equal(refreshes, 1);
});
test('login loads me, broadcasts only control and never persists credentials in state', async () => {
  const f = fixture();
  await f.controller.login(user.email, 'synthetic-password');
  assert.deepEqual(f.calls, ['login', 'me']);
  assert.deepEqual(f.messages, ['identity-changed']);
  assert(
    !JSON.stringify(f.controller.getSnapshot()).includes('synthetic-password'),
  );
});
test('authenticated GET retries once after refresh, never loops on repeated 401', async () => {
  let reads = 0;
  const f = fixture({
    me: async () => {
      reads++;
      if (reads > 1) throw new ApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401);
      return user;
    },
  });
  await f.controller.login(user.email, 'password');
  await f.controller.reloadUser();
  assert.equal(reads, 3);
  assert.deepEqual(f.calls, ['login', 'refresh']);
  assert.equal(f.controller.getSnapshot().status, 'anonymous');
});
test('authenticated GET can recover once with a replacement access token', async () => {
  let reads = 0;
  const f = fixture({
    me: async () => {
      reads++;
      if (reads === 2) throw new ApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401);
      return user;
    },
  });
  await f.controller.login(user.email, 'password');
  await f.controller.reloadUser();
  assert.equal(reads, 3);
  assert.equal(f.controller.getSnapshot().status, 'authenticated');
});
test('invalid sessions become anonymous, account safeguards block, availability errors remain errors', async () => {
  for (const [error, status] of [
    [new ApiError('AUTH_REFRESH_TOKEN_REUSED', 401), 'anonymous'],
    [new ApiError('USER_NOT_FOUND', 404), 'anonymous'],
    [new ApiError('AUTH_ACCOUNT_DISABLED', 403), 'blocked'],
    [new ApiError('AUTH_ACCOUNT_SUSPENDED', 403), 'blocked'],
    [new ApiError('AUTH_EMAIL_NOT_VERIFIED', 403), 'blocked'],
    [new ApiError('DEPENDENCY_UNAVAILABLE', 503), 'error'],
    [new ApiError('RATE_LIMIT_EXCEEDED', 429), 'error'],
  ] as const) {
    let count = 0;
    const f = fixture({
      refresh: async () => {
        count++;
        throw error;
      },
    });
    await f.controller.restore();
    assert.equal(f.controller.getSnapshot().status, status);
    assert.equal(count, 1);
    assert.equal(f.controller.getSnapshot().user, null);
  }
});
test('ambiguous refresh is not retried even by restore; explicit login can recover', async () => {
  let count = 0;
  const f = fixture({
    refresh: async () => {
      count++;
      throw new ApiError('NETWORK_ERROR');
    },
  });
  await f.controller.restore();
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  await f.controller.restore(true);
  assert.equal(count, 1);
  assert.deepEqual(f.messages, ['uncertain']);
  await f.controller.login(user.email, 'password');
  assert.equal(f.controller.getSnapshot().status, 'authenticated');
});
test('logout waits for in-flight rotation and late responses cannot restore identity', async () => {
  const gate = deferred<typeof access>();
  const order: string[] = [];
  const f = fixture({
    refresh: async () => {
      order.push('refresh-start');
      const result = await gate.promise;
      order.push('refresh-end');
      return result;
    },
    logout: async () => {
      order.push('logout');
      return null;
    },
  });
  const restoration = f.controller.restore();
  await Promise.resolve();
  const logout = f.controller.logout();
  gate.resolve(access);
  await Promise.all([restoration, logout]);
  assert.deepEqual(order, ['refresh-start', 'refresh-end', 'logout']);
  assert.equal(f.controller.getSnapshot().status, 'anonymous');
  assert.equal(f.controller.getSnapshot().user, null);
  assert.deepEqual(f.messages, ['signed-out']);
});
test('logout dependency failure retains identity and never broadcasts success', async () => {
  const f = fixture({
    logout: async () => {
      throw new ApiError('DEPENDENCY_UNAVAILABLE', 503);
    },
  });
  await f.controller.login(user.email, 'password');
  await f.controller.logout();
  assert.equal(f.controller.getSnapshot().status, 'authenticated');
  assert.deepEqual(f.controller.getSnapshot().user, user);
  assert.match(f.controller.getSnapshot().message, /not confirmed/);
  assert(!f.messages.includes('signed-out'));
});
test('cross-tab control discards identity and prevents outstanding profile result adoption', async () => {
  const gate = deferred<CurrentUser>();
  const f = fixture({ me: async () => gate.promise });
  const login = f.controller.login(user.email, 'password');
  await Promise.resolve();
  await Promise.resolve();
  f.emit('signed-out');
  gate.resolve(user);
  await login;
  assert.equal(f.controller.getSnapshot().status, 'anonymous');
  assert.equal(f.controller.getSnapshot().user, null);
});
test('ADMIN is identifiable for access state; malformed active eligibility is never accepted', async () => {
  const admin = fixture({ me: async () => ({ ...user, role: 'ADMIN' }) });
  await admin.controller.restore();
  assert.equal(admin.controller.getSnapshot().user?.role, 'ADMIN');
  for (const patch of [
    { status: 'DISABLED' as const },
    { status: 'SUSPENDED' as const },
    { status: 'PENDING_VERIFICATION' as const },
    { emailVerified: false },
  ]) {
    const f = fixture({ me: async () => ({ ...user, ...patch }) });
    await f.controller.restore();
    assert.equal(f.controller.getSnapshot().status, 'blocked');
  }
  const unsupported = fixture({}, false);
  assert.equal(unsupported.controller.getSnapshot().status, 'unsupported');
  await unsupported.controller.restore();
  assert.deepEqual(unsupported.calls, []);
});
