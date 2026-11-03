import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLearningPathController } from '../src/lib/learning-paths/learning-path-controller';
import { LearningPathError } from '../src/lib/learning-paths/learning-path-client';
import { TechnologyError } from '../src/lib/technologies/technology-client';
import type {
  LearningPath,
  LearningPathRequest,
  LearningPathResult,
} from '../src/lib/learning-paths/contracts';
import type {
  Technology,
  TechnologyRequest,
  TechnologyResult,
} from '../src/lib/technologies/contracts';
import type { AdminState } from '../src/lib/auth/admin-controller';

const account = 'f'.repeat(24),
  parentId = 'a'.repeat(24);
const parent: Technology = {
  id: parentId,
  name: 'Technology',
  slug: 'technology',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
};
const item: LearningPath = {
  id: 'b'.repeat(24),
  technologyId: parentId,
  title: 'Path',
  slug: 'path',
  description: null,
  targetLevel: null,
  completionScore: 80,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: parent.createdAt,
  updatedAt: parent.updatedAt,
};
const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture() {
  let snapshot: AdminState = {
    status: 'eligible',
    pending: false,
    message: '',
    user: {
      id: account,
      firstName: 'Fixture',
      lastName: 'Admin',
      email: 'fixture@example.test',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  };
  const listeners = new Set<() => void>();
  const requests: (TechnologyRequest | LearningPathRequest)[] = [],
    signals: AbortSignal[] = [];
  let technology = async (r: TechnologyRequest): Promise<TechnologyResult> =>
    r.kind === 'list'
      ? {
          items: [
            parent,
            {
              ...parent,
              id: 'c'.repeat(24),
              slug: 'typescript',
              name: 'Other',
              status: 'ARCHIVED',
            },
          ],
          pagination: { ...pagination, total: 2 },
        }
      : parent;
  let path = async (r: LearningPathRequest): Promise<LearningPathResult> =>
    r.kind === 'list'
      ? {
          items: [{ ...item, technologyId: r.query.technologyId }],
          pagination: { ...pagination, page: r.query.page },
        }
      : { ...item, id: r.id, technologyId: r.technologyId };
  const controller = createLearningPathController(
    {
      getSnapshot: () => snapshot,
      subscribe(fn) {
        listeners.add(fn);
        return () => {
          listeners.delete(fn);
        };
      },
      async requestTechnology(id, r, signal) {
        assert.equal(id, account);
        requests.push(r);
        signals.push(signal!);
        return technology(r);
      },
      async requestLearningPath(id, r, signal) {
        assert.equal(id, account);
        requests.push(r);
        signals.push(signal!);
        return path(r);
      },
    },
    account,
  );
  const disconnect = controller.connect();
  return {
    controller,
    requests,
    signals,
    disconnect,
    listeners,
    setTechnology(fn: typeof technology) {
      technology = fn;
    },
    setPath(fn: typeof path) {
      path = fn;
    },
    setSnapshot(s: AdminState) {
      snapshot = s;
      for (const fn of listeners) fn();
    },
    snapshot: () => snapshot,
  };
}
test('chooser is bounded and selecting a real parent binds every child read', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    await f.controller.detail(item.id);
    assert.deepEqual(f.requests, [
      { kind: 'list', query: { page: 1, limit: 20 } },
      { kind: 'list', query: { technologyId: parentId, page: 1, limit: 20 } },
      { kind: 'detail', technologyId: parentId, id: item.id },
    ]);
    assert.equal(f.controller.getSnapshot().detail?.id, item.id);
  } finally {
    f.controller.dispose();
  }
});
test('unknown selection and invalid pages never dispatch', async () => {
  const f = fixture();
  try {
    await f.controller.selectTechnology(parentId);
    await f.controller.parents(502);
    await f.controller.parents(0);
    assert.equal(f.requests.length, 0);
  } finally {
    f.controller.dispose();
  }
});
test('Technology replacement aborts old requests and rejects late success', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    const old = deferred<LearningPathResult>();
    f.setPath(() => old.promise);
    const first = f.controller.selectTechnology(parentId);
    f.setPath(async (r) => ({
      items: [
        {
          ...item,
          technologyId:
            r.kind === 'list' ? r.query.technologyId : r.technologyId,
        },
      ],
      pagination,
    }));
    await f.controller.selectTechnology('c'.repeat(24));
    assert(f.signals[1]!.aborted);
    old.resolve({ items: [item], pagination });
    await first;
    assert.equal(f.controller.getSnapshot().parent?.id, 'c'.repeat(24));
    assert.equal(
      f.controller.getSnapshot().paths?.items[0]?.technologyId,
      'c'.repeat(24),
    );
  } finally {
    f.controller.dispose();
  }
});
test('older detail success and error cannot replace a newer selection', async () => {
  for (const reject of [false, true]) {
    const f = fixture();
    try {
      await f.controller.parents();
      await f.controller.selectTechnology(parentId);
      const old = deferred<LearningPathResult>();
      f.setPath(() => old.promise);
      const pending = f.controller.detail(item.id);
      f.setPath(async () => ({ ...item, title: 'Newer' }));
      await f.controller.detail(item.id);
      if (reject) old.reject(new LearningPathError('UNAVAILABLE'));
      else old.resolve({ ...item, title: 'Old' });
      await pending;
      assert.equal(f.controller.getSnapshot().detail?.title, 'Newer');
      assert.equal(f.controller.getSnapshot().status, 'ready');
    } finally {
      f.controller.dispose();
    }
  }
});
for (const kind of [
  'logout',
  'account-switch',
  'pending-session',
  'unmount',
] as const)
  test(kind + ' clears all private data and refuses late reads', async () => {
    const f = fixture();
    try {
      await f.controller.parents();
      const delayed = deferred<LearningPathResult>();
      f.setPath(() => delayed.promise);
      const pending = f.controller.selectTechnology(parentId);
      if (kind === 'unmount') f.disconnect();
      else
        f.setSnapshot(
          kind === 'logout'
            ? { status: 'anonymous', user: null, pending: false, message: '' }
            : kind === 'pending-session'
              ? { ...f.snapshot(), pending: true }
              : {
                  ...f.snapshot(),
                  user: { ...f.snapshot().user!, id: 'e'.repeat(24) },
                },
        );
      delayed.resolve({ items: [item], pagination });
      await pending;
      const s = f.controller.getSnapshot();
      assert.equal(s.parent, null);
      assert.equal(s.parents, null);
      assert.equal(s.paths, null);
      assert.equal(s.detail, null);
      assert(f.signals[1]!.aborted);
    } finally {
      f.controller.dispose();
    }
  });
test('delayed authentication readiness refuses early fetch and permits explicit ready load', async () => {
  const f = fixture();
  try {
    const ready = f.snapshot();
    f.setSnapshot({ ...ready, status: 'checking', user: null, pending: true });
    await f.controller.parents();
    assert.equal(f.requests.length, 0);
    f.setSnapshot(ready);
    await f.controller.parents();
    assert.equal(f.requests.length, 1);
  } finally {
    f.controller.dispose();
  }
});
test('changing chooser page clears parent, list and detail immediately', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    await f.controller.detail(item.id);
    f.setTechnology(async () => ({
      items: [],
      pagination: { ...pagination, page: 2 },
    }));
    await f.controller.parents(2);
    const s = f.controller.getSnapshot();
    assert.equal(s.parent, null);
    assert.equal(s.paths, null);
    assert.equal(s.detail, null);
    assert.equal(s.parentPage, 2);
  } finally {
    f.controller.dispose();
  }
});
test('later empty child page is valid and clears detail', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    f.setPath(async () => ({
      items: [],
      pagination: { ...pagination, page: 2 },
    }));
    await f.controller.paths(2);
    assert.equal(f.controller.getSnapshot().page, 2);
    assert.equal(f.controller.getSnapshot().paths?.items.length, 0);
    assert.match(f.controller.getSnapshot().message, /No Learning Paths/);
  } finally {
    f.controller.dispose();
  }
});
test('Refresh reloads parent metadata before children and accepts archived parent', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    f.setTechnology(async () => ({ ...parent, status: 'ARCHIVED' }));
    await f.controller.refresh();
    assert.deepEqual(
      f.requests.slice(-2).map((v) => v.kind),
      ['detail', 'list'],
    );
    assert.equal(f.controller.getSnapshot().parent?.status, 'ARCHIVED');
  } finally {
    f.controller.dispose();
  }
});
for (const code of [
  'PARENT_NOT_FOUND',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UNAVAILABLE',
  'TIMEOUT',
  'NETWORK_ERROR',
  'INVALID_RESPONSE',
  'CANCELLED',
] as const)
  test(code + ' is explicit and never automatically retried', async () => {
    const f = fixture();
    try {
      await f.controller.parents();
      f.setPath(async () => {
        throw new LearningPathError(
          code,
          code === 'PARENT_NOT_FOUND' || code === 'NOT_FOUND' ? 404 : 0,
        );
      });
      await f.controller.selectTechnology(parentId);
      assert.equal(f.requests.length, 2);
      assert.equal(f.controller.getSnapshot().status, 'error');
      assert.equal(
        f.controller.getSnapshot().parent === null,
        code === 'PARENT_NOT_FOUND',
      );
      if (code !== 'PARENT_NOT_FOUND') {
        f.setPath(async () => ({ items: [item], pagination }));
        await f.controller.retry();
        assert.equal(f.requests.length, 3);
        assert.equal(f.controller.getSnapshot().status, 'ready');
      }
    } finally {
      f.controller.dispose();
    }
  });
for (const status of [401, 403])
  test(
    status + ' clears private state even with an inert auth mock',
    async () => {
      const f = fixture();
      try {
        await f.controller.parents();
        f.setPath(async () => {
          throw new LearningPathError(
            status === 401 ? 'AUTH_REQUIRED' : 'FORBIDDEN',
            status,
          );
        });
        await f.controller.selectTechnology(parentId);
        assert.equal(f.controller.getSnapshot().status, 'denied');
        assert.equal(f.controller.getSnapshot().parents, null);
      } finally {
        f.controller.dispose();
      }
    },
  );
test('unavailable parent on Refresh returns to chooser, not empty child success', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    f.setTechnology(async () => {
      throw new TechnologyError('NOT_FOUND', 404);
    });
    await f.controller.refresh();
    assert.equal(f.controller.getSnapshot().parent, null);
    assert.equal(f.controller.getSnapshot().status, 'error');
    assert.equal(f.requests.length, 3);
  } finally {
    f.controller.dispose();
  }
});
test('controller refuses wrong-parent detail even if a client collaborator is faulty', async () => {
  const f = fixture();
  try {
    await f.controller.parents();
    await f.controller.selectTechnology(parentId);
    f.setPath(async () => ({ ...item, technologyId: 'e'.repeat(24) }));
    await f.controller.detail(item.id);
    assert.equal(f.controller.getSnapshot().detail, null);
    assert.equal(f.controller.getSnapshot().status, 'error');
  } finally {
    f.controller.dispose();
  }
});
test('disconnect and dispose remove auth listeners', () => {
  const f = fixture();
  assert.equal(f.listeners.size, 1);
  f.disconnect();
  assert.equal(f.listeners.size, 0);
  f.controller.connect();
  f.controller.dispose();
  assert.equal(f.listeners.size, 0);
});
