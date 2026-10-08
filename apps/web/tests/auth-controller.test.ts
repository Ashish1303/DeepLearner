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
const preferences = {
  experienceLevel: 'BEGINNER' as const,
  learningGoals: ['LEARN_FROM_SCRATCH' as const],
  preferredDifficulty: 'BEGINNER' as const,
  dailyStudyGoalMinutes: 30,
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
    async patchProfile(_token, profile) {
      calls.push('patch');
      return { ...user, profile: { ...profile, interestedTechnologyIds: [] } };
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

test('profile save checks authoritative user then adopts PATCH response without changing unrelated fields', async () => {
  const saved = {
    ...user,
    profile: { ...preferences, interestedTechnologyIds: [] },
  };
  const f = fixture({
    patchProfile: async (_token, input) => {
      assert.deepEqual(input, preferences);
      return saved;
    },
  });
  await f.controller.login(user.email, 'password');
  assert.equal((await f.controller.saveProfile(preferences)).kind, 'success');
  assert.deepEqual(f.calls, ['login', 'me', 'me']);
  assert.deepEqual(f.controller.getSnapshot().user, saved);
  assert.deepEqual(f.messages, ['identity-changed']);
});

test('recoverable profile failures retain account and never replay mutations', async () => {
  for (const error of [
    new ApiError('VALIDATION_ERROR', 400),
    new ApiError('RATE_LIMIT_EXCEEDED', 429),
    new ApiError('DEPENDENCY_UNAVAILABLE', 503),
  ]) {
    let patches = 0;
    const f = fixture({
      patchProfile: async () => {
        patches++;
        throw error;
      },
    });
    await f.controller.restore();
    assert.equal((await f.controller.saveProfile(preferences)).kind, 'error');
    assert.deepEqual(f.controller.getSnapshot().user, user);
    assert.equal(f.controller.getSnapshot().pending, false);
    assert.equal(patches, 1);
  }
});

test('ambiguous PATCH and PATCH 401 require a read-only check and explicit resubmission', async () => {
  for (const error of [
    new ApiError('NETWORK_ERROR'),
    new ApiError('INVALID_RESPONSE'),
    new ApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401),
  ]) {
    let patches = 0;
    const f = fixture({
      patchProfile: async () => {
        patches++;
        if (patches === 1) throw error;
        return {
          ...user,
          profile: { ...preferences, interestedTechnologyIds: [] },
        };
      },
    });
    await f.controller.restore();
    const result = await f.controller.saveProfile(preferences);
    assert.equal(result.kind, error.status === 401 ? 'reverify' : 'uncertain');
    assert.equal(
      (await f.controller.saveProfile(preferences)).kind,
      'reverify',
    );
    assert.equal(patches, 1);
    assert.equal((await f.controller.checkProfile()).kind, 'success');
    assert.equal(patches, 1);
    assert.equal((await f.controller.saveProfile(preferences)).kind, 'success');
    assert.equal(patches, 2);
  }
});

test('read-only reconciliation adopts a committed profile without a second PATCH', async () => {
  let committed = false;
  const saved = {
    ...user,
    profile: { ...preferences, interestedTechnologyIds: [] },
  };
  let patches = 0;
  const f = fixture({
    me: async () => (committed ? saved : user),
    patchProfile: async () => {
      patches++;
      committed = true;
      throw new ApiError('NETWORK_ERROR');
    },
  });
  await f.controller.restore();
  await f.controller.saveProfile(preferences);
  assert.equal((await f.controller.checkProfile()).kind, 'success');
  assert.equal(patches, 1);
  assert.deepEqual(f.controller.getSnapshot().user, saved);
});

test('preflight GET refreshes once before PATCH and rejects current account restrictions', async () => {
  let reads = 0;
  const f = fixture({
    me: async () => {
      if (++reads === 2) throw new ApiError('AUTH_ACCESS_TOKEN_EXPIRED', 401);
      return user;
    },
  });
  await f.controller.login(user.email, 'password');
  await f.controller.saveProfile(preferences);
  assert.deepEqual(f.calls, ['login', 'refresh', 'patch']);
  for (const patch of [
    { role: 'ADMIN' as const },
    { status: 'DISABLED' as const },
    { status: 'SUSPENDED' as const },
    { emailVerified: false },
  ]) {
    let restricted = false;
    let writes = 0;
    const g = fixture({
      me: async () => (restricted ? { ...user, ...patch } : user),
      patchProfile: async () => {
        writes++;
        return user;
      },
    });
    await g.controller.restore();
    restricted = true;
    assert.equal((await g.controller.saveProfile(preferences)).kind, 'error');
    assert.equal(writes, 0);
  }
});

test('late profile results after logout or cross-tab invalidation never restore identity', async () => {
  for (const control of ['logout', 'identity-changed'] as const) {
    const gate = deferred<CurrentUser>();
    const started = deferred<void>();
    const f = fixture({
      patchProfile: async () => {
        started.resolve();
        return gate.promise;
      },
    });
    await f.controller.restore();
    const save = f.controller.saveProfile(preferences);
    await started.promise;
    const stop =
      control === 'logout'
        ? f.controller.logout()
        : Promise.resolve(f.emit(control));
    gate.resolve({
      ...user,
      profile: { ...preferences, interestedTechnologyIds: [] },
    });
    await stop;
    assert.equal((await save).kind, 'interrupted');
    assert.equal(f.controller.getSnapshot().status, 'anonymous');
    assert.equal(f.controller.getSnapshot().user, null);
  }
});

test('failed reconciliation does not permit another PATCH, and preflight network failure preserves identity', async () => {
  let failReads = false;
  let writes = 0;
  const f = fixture({
    me: async () => {
      if (failReads) throw new ApiError('NETWORK_ERROR');
      return user;
    },
    patchProfile: async () => {
      writes++;
      throw new ApiError('NETWORK_ERROR');
    },
  });
  await f.controller.restore();
  failReads = true;
  assert.equal((await f.controller.saveProfile(preferences)).kind, 'error');
  assert.equal(writes, 0);
  assert.deepEqual(f.controller.getSnapshot().user, user);
  failReads = false;
  await f.controller.saveProfile(preferences);
  failReads = true;
  assert.equal((await f.controller.checkProfile()).kind, 'error');
  assert.equal((await f.controller.saveProfile(preferences)).kind, 'reverify');
  assert.equal(writes, 1);
});

test('profile preflight prevents cross-account writes and preserves the ADMIN access state', async () => {
  for (const changed of [
    { ...user, id: 'b'.repeat(24) },
    { ...user, role: 'ADMIN' as const },
  ]) {
    let reads = 0;
    const f = fixture({ me: async () => (++reads === 1 ? user : changed) });
    await f.controller.restore();
    assert.equal((await f.controller.saveProfile(preferences)).kind, 'error');
    assert(!f.calls.includes('patch'));
    if (changed.role === 'ADMIN')
      assert.equal(f.controller.getSnapshot().user?.role, 'ADMIN');
    else assert.equal(f.controller.getSnapshot().status, 'anonymous');
  }
});

test('parallel submissions cannot duplicate PATCH and invalid saved DTO is never adopted', async () => {
  const gate = deferred<CurrentUser>();
  const started = deferred<void>();
  let writes = 0;
  const f = fixture({
    patchProfile: async () => {
      writes++;
      started.resolve();
      return gate.promise;
    },
  });
  await f.controller.restore();
  const first = f.controller.saveProfile(preferences);
  await started.promise;
  assert.equal((await f.controller.saveProfile(preferences)).kind, 'busy');
  gate.resolve({
    ...user,
    id: 'b'.repeat(24),
    profile: { ...preferences, interestedTechnologyIds: [] },
  });
  assert.equal((await first).kind, 'uncertain');
  assert.equal(writes, 1);
  assert.deepEqual(f.controller.getSnapshot().user, user);
});
