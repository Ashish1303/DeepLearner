import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createTechnologyController } from '../src/lib/technologies/technology-controller';
import { TechnologyError } from '../src/lib/technologies/technology-client';
import type {
  Technology,
  TechnologyResult,
  TechnologyRequest,
} from '../src/lib/technologies/contracts';
import type { AdminState } from '../src/lib/auth/admin-controller';

const item: Technology = {
  id: 'a'.repeat(24),
  name: 'TypeScript',
  slug: 'typescript',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const identity = {
  id: 'b'.repeat(24),
  firstName: 'Fixture',
  lastName: 'Admin',
  email: 'fixture@example.test',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
  emailVerified: true as const,
};
const page = {
  items: [item],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
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
function fixture(
  t: TestContext,
  work: (
    request: TechnologyRequest,
    signal?: AbortSignal,
  ) => Promise<TechnologyResult> = async (r) =>
    r.kind === 'list' ? page : item,
) {
  let state: AdminState = {
    status: 'eligible',
    user: identity,
    pending: false,
    message: '',
  };
  const listeners = new Set<() => void>();
  const calls: TechnologyRequest[] = [],
    signals: AbortSignal[] = [];
  const auth = {
    hasTechnologyUncertainty: () => false,
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    async requestTechnology(
      account: string,
      request: TechnologyRequest,
      signal?: AbortSignal,
    ) {
      assert.equal(account, identity.id);
      calls.push(request);
      if (signal) signals.push(signal);
      return work(request, signal);
    },
    reconcileTechnology(
      account: string,
      request: Extract<TechnologyRequest, { kind: 'list' | 'detail' }>,
      signal?: AbortSignal,
    ) {
      return this.requestTechnology(account, request, signal);
    },
  };
  const controller = createTechnologyController(auth, identity.id);
  const disconnect = controller.connect();
  t.after(() => controller.dispose());
  return {
    controller,
    disconnect,
    calls,
    signals,
    emit(next: Partial<AdminState>) {
      state = { ...state, ...next };
      for (const fn of listeners) fn();
    },
  };
}
test('inventory and selected detail live only inside the current account controller', async (t) => {
  const f = fixture(t);
  await f.controller.list();
  assert.deepEqual(f.controller.getSnapshot().page, page);
  await f.controller.detail(item.id);
  assert.equal(f.controller.getSnapshot().detail?.id, item.id);
  f.emit({ status: 'anonymous', user: null });
  assert.equal(f.controller.getSnapshot().page, null);
  assert.equal(f.controller.getSnapshot().detail, null);
  assert.equal(f.controller.getSnapshot().status, 'denied');
});
for (const state of [
  { status: 'checking' as const },
  { status: 'eligible' as const, user: { ...identity, id: 'c'.repeat(24) } },
  { pending: true },
  { status: 'expired' as const },
  { status: 'denied' as const },
])
  test(
    'authority loss suppresses an already dispatched response ' +
      JSON.stringify(state),
    async (t) => {
      const wait = deferred<TechnologyResult>();
      const f = fixture(t, async () => wait.promise);
      const pending = f.controller.list();
      f.emit(state);
      assert(f.signals[0]?.aborted);
      wait.resolve(page);
      await pending;
      assert.equal(f.controller.getSnapshot().page, null);
    },
  );
test('a superseded read cannot overwrite a later selection', async (t) => {
  const wait = deferred<TechnologyResult>();
  const f = fixture(t, async (r) => (r.kind === 'list' ? wait.promise : item));
  const pending = f.controller.list();
  await f.controller.detail(item.id);
  wait.resolve(page);
  await pending;
  assert.equal(f.controller.getSnapshot().detail?.id, item.id);
  assert.equal(f.controller.getSnapshot().page, null);
});
test('invalid input is refused before the capability is called', async (t) => {
  const f = fixture(t);
  await f.controller.list(502);
  await f.controller.detail('../private');
  await f.controller.create({
    name: 'A',
    slug: 'a',
    actorId: identity.id,
  } as never);
  assert.equal(f.calls.length, 0);
});
for (const status of ['PUBLISHED', 'ARCHIVED'] as const)
  test(status + ' has no admitted edit operation', async (t) => {
    const f = fixture(t, async () => ({ ...item, status }));
    await f.controller.detail(item.id);
    await f.controller.patch(item.id, { revision: 0, name: 'Changed' });
    assert.equal(f.calls.length, 1);
    assert.equal(f.controller.getSnapshot().status, 'conflict');
  });
test('revision mismatch is rejected locally before mutation', async (t) => {
  const f = fixture(t);
  await f.controller.detail(item.id);
  await f.controller.patch(item.id, { revision: 1, name: 'A' });
  assert.equal(f.calls.length, 1);
  assert(f.controller.getSnapshot().needsReconciliation);
});
test('duplicate submit is refused and successful draft mutation is validated', async (t) => {
  const wait = deferred<TechnologyResult>();
  const f = fixture(t, async () => wait.promise);
  const input = { name: item.name, slug: item.slug };
  const pending = f.controller.create(input);
  await f.controller.create(input);
  assert.equal(f.calls.length, 1);
  wait.resolve(item);
  await pending;
  assert.equal(f.controller.getSnapshot().status, 'success');
});
for (const error of [
  new TechnologyError('NETWORK_ERROR'),
  new TechnologyError('TIMEOUT'),
  new TechnologyError('UNAVAILABLE', 503),
  new TechnologyError('INVALID_RESPONSE'),
])
  test('uncertain mutation is never replayed: ' + error.code, async (t) => {
    let fail = true;
    const f = fixture(t, async (r) => {
      if (fail) throw error;
      return r.kind === 'list' ? page : item;
    });
    const input = { name: item.name, slug: item.slug };
    await f.controller.create(input);
    assert.equal(f.controller.getSnapshot().status, 'uncertain');
    assert.equal(f.controller.getSnapshot().detail, null);
    await f.controller.create(input);
    assert.equal(f.calls.length, 1);
    fail = false;
    await f.controller.list();
    assert.equal(f.calls.length, 2);
    assert(!f.controller.getSnapshot().needsReconciliation);
    assert.equal(f.controller.getSnapshot().status, 'ready');
  });
test('revision conflict requires explicit read reconciliation and retains no editable stale record', async (t) => {
  const f = fixture(t, async (r) => {
    if (r.kind === 'patch') throw new TechnologyError('CONFLICT', 409);
    return item;
  });
  await f.controller.detail(item.id);
  await f.controller.patch(item.id, { revision: 0, name: 'A' });
  assert.equal(f.controller.getSnapshot().status, 'conflict');
  assert.equal(f.controller.getSnapshot().detail, null);
  await f.controller.patch(item.id, { revision: 0, name: 'B' });
  assert.equal(f.calls.length, 2);
});
for (const [status, code] of [
  [404, 'NOT_FOUND'],
  [429, 'RATE_LIMITED'],
  [503, 'UNAVAILABLE'],
] as const)
  test('read error ' + status + ' exposes only static safe text', async (t) => {
    const f = fixture(t, async () => {
      throw new TechnologyError(code, status);
    });
    await f.controller.list();
    assert.equal(f.controller.getSnapshot().status, 'error');
    assert.equal(f.calls.length, 1);
    assert.equal(f.controller.getSnapshot().page, null);
  });
test('an unexpected thrown exception is sanitized', async (t) => {
  const f = fixture(t, async () => {
    throw new Error('SYNTHETIC_PRIVATE_STACK');
  });
  await f.controller.list();
  assert(!JSON.stringify(f.controller.getSnapshot()).includes('SYNTHETIC'));
});
test('cancelled writes stay uncertain and late completion is ignored', async (t) => {
  const wait = deferred<TechnologyResult>();
  const f = fixture(t, async () => wait.promise);
  const pending = f.controller.create({ name: item.name, slug: item.slug });
  f.controller.cancel();
  wait.resolve(item);
  await pending;
  assert.equal(f.controller.getSnapshot().status, 'uncertain');
  assert.equal(f.controller.getSnapshot().detail, null);
  assert(f.signals[0]?.aborted);
});
test('StrictMode-style disconnect/reconnect is reversible without retaining data', async (t) => {
  const f = fixture(t);
  await f.controller.list();
  f.disconnect();
  assert.equal(f.controller.getSnapshot().page, null);
  f.controller.connect();
  await f.controller.list();
  assert.equal(f.controller.getSnapshot().status, 'ready');
});
test('private or inconsistent capability data cannot enter controller state', async (t) => {
  const f = fixture(
    t,
    async () => ({ ...page, private: 'synthetic' }) as never,
  );
  await f.controller.list();
  assert.equal(f.controller.getSnapshot().status, 'error');
  assert.equal(f.controller.getSnapshot().page, null);
});
