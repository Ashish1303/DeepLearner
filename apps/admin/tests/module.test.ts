import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createModuleClient,
  ModuleError,
} from '../src/lib/modules/module-client';
import {
  moduleDto,
  moduleRequest,
  validateModulePage,
} from '../src/lib/modules/contracts';
import { createModuleController } from '../src/lib/modules/module-controller';
import type { AdminController } from '../src/lib/auth/admin-controller';
const technologyId = 'a'.repeat(24),
  learningPathId = 'b'.repeat(24),
  id = 'c'.repeat(24),
  account = 'd'.repeat(24);
const item = {
  id,
  technologyId,
  learningPathId,
  title: 'Module',
  slug: 'module',
  description: null,
  status: 'ARCHIVED' as const,
  order: 0,
  revision: 0,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};
const query = { technologyId, learningPathId, page: 1, limit: 20 },
  pagination = { page: 1, limit: 20, total: 1, totalPages: 1 },
  page = { items: [item], pagination };
test('module private DTO and requests reject extra fields, operators and missing binding', () => {
  assert(moduleDto.safeParse(item).success);
  assert(!moduleDto.safeParse({ ...item, accessToken: 'PRIVATE' }).success);
  assert(
    !moduleRequest.safeParse({ kind: 'detail', id, technologyId }).success,
  );
  assert(!moduleRequest.safeParse({ kind: 'create', query }).success);
  assert.throws(() =>
    validateModulePage(
      { ...page, items: [{ ...item, learningPathId: id }] },
      query,
    ),
  );
  assert.throws(() =>
    validateModulePage(
      { ...page, items: [item, item], pagination: { ...pagination, total: 2 } },
      query,
    ),
  );
});
test('module client uses fixed authenticated GET, both parents, no cookies and strict response', async () => {
  const calls: string[] = [];
  const client = createModuleClient(
    'http://127.0.0.1:4000/api/v1',
    async (url, options) => {
      calls.push(String(url));
      assert.equal(options?.method, 'GET');
      assert.equal(options?.credentials, 'omit');
      assert.equal(options?.redirect, 'error');
      assert.equal(
        (options?.headers as Record<string, string>).Authorization,
        'Bearer synthetic-access',
      );
      return Response.json({
        success: true,
        data: [item],
        message: null,
        meta: { requestId: 'fixture', ...pagination },
      });
    },
  );
  assert.deepEqual(
    await client.execute(
      { kind: 'list', query },
      'synthetic-access',
      new AbortController().signal,
    ),
    page,
  );
  assert.equal(
    calls[0],
    `http://127.0.0.1:4000/api/v1/admin/modules?technologyId=${technologyId}&learningPathId=${learningPathId}&page=1&limit=20`,
  );
  assert.throws(() => createModuleClient('https://unapproved.example/api/v1'));
});
test('module client rejects cross-parent detail, private extras and explicit auth refusal', async () => {
  for (const data of [
    { ...item, learningPathId: id },
    { ...item, internal: 'PRIVATE' },
  ]) {
    const client = createModuleClient(
      'http://127.0.0.1:4000/api/v1',
      async () =>
        Response.json({
          success: true,
          data,
          message: null,
          meta: { requestId: 'fixture' },
        }),
    );
    await assert.rejects(
      client.execute(
        { kind: 'detail', id, technologyId, learningPathId },
        'synthetic-access',
        new AbortController().signal,
      ),
      ModuleError,
    );
  }
  const client = createModuleClient(
    'http://127.0.0.1:4000/api/v1',
    async () => new Response('PRIVATE', { status: 403 }),
  );
  await assert.rejects(
    client.execute(
      { kind: 'list', query },
      'synthetic-access',
      new AbortController().signal,
    ),
    (e: unknown) =>
      e instanceof ModuleError &&
      e.status === 403 &&
      !e.message.includes('PRIVATE'),
  );
});
function fixture(
  execute: (request: unknown, signal: AbortSignal) => Promise<unknown>,
) {
  let eligible = true;
  const listeners = new Set<() => void>();
  const auth = {
    getSnapshot: () => ({
      status: eligible ? 'eligible' : 'anonymous',
      pending: false,
      user: eligible
        ? { id: account, role: 'ADMIN', status: 'ACTIVE', emailVerified: true }
        : null,
    }),
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    requestModule: (_account: string, request: unknown, signal: AbortSignal) =>
      execute(request, signal),
  } as unknown as AdminController;
  const controller = createModuleController(
      auth,
      account,
      technologyId,
      learningPathId,
    ),
    disconnect = controller.connect();
  return {
    controller,
    disconnect,
    logout() {
      eligible = false;
      for (const fn of listeners) fn();
    },
    listeners,
  };
}
test('module controller binds pages/detail and refuses arbitrary IDs and invalid page offsets', async () => {
  const calls: unknown[] = [];
  const f = fixture(async (request) => {
    calls.push(request);
    return (request as { kind: string }).kind === 'list' ? page : item;
  });
  try {
    await f.controller.list();
    await f.controller.detail(id);
    assert.equal(f.controller.getSnapshot().detail?.id, id);
    await f.controller.detail('e'.repeat(24));
    await f.controller.list(502);
    assert.equal(calls.length, 2);
  } finally {
    f.disconnect();
  }
});
test('logout during loading aborts and late data cannot repopulate private state', async () => {
  let resolve!: (v: unknown) => void, signal!: AbortSignal;
  const delayed = new Promise((r) => {
    resolve = r;
  });
  const f = fixture(async (_request, s) => {
    signal = s;
    return delayed;
  });
  const pending = f.controller.list();
  f.logout();
  assert(signal.aborted);
  resolve(page);
  await pending;
  assert.equal(f.controller.getSnapshot().page, null);
  assert.equal(f.controller.getSnapshot().status, 'denied');
  f.disconnect();
  assert.equal(f.listeners.size, 0);
});
test('a newer page supersedes a late older response and cancellation is observed', async () => {
  let resolve!: (v: unknown) => void, first!: AbortSignal;
  let calls = 0;
  const delayed = new Promise((r) => {
    resolve = r;
  });
  const f = fixture(async (_request, s) => {
    calls++;
    if (calls === 1) {
      first = s;
      return delayed;
    }
    return {
      items: [],
      pagination: { page: 2, limit: 20, total: 20, totalPages: 1 },
    };
  });
  const older = f.controller.list();
  await f.controller.list(2);
  resolve(page);
  await older;
  assert(first.aborted);
  assert.equal(f.controller.getSnapshot().page?.pagination.page, 2);
  f.disconnect();
});
test('errors are safe and no automatic retry is dispatched', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    throw Error('PRIVATE_STACK');
  });
  try {
    await f.controller.list();
    assert.equal(calls, 1);
    assert(!f.controller.getSnapshot().message.includes('PRIVATE'));
    await f.controller.retry();
    assert.equal(calls, 2);
  } finally {
    f.disconnect();
  }
});

test('StrictMode disconnect/reconnect stays usable while discarding previous private data', async () => {
  const f = fixture(async () => page);
  f.disconnect();
  assert.equal(f.controller.getSnapshot().status, 'idle');
  const disconnect = f.controller.connect();
  try {
    await f.controller.list();
    assert.equal(f.controller.getSnapshot().status, 'ready');
    assert.equal(f.controller.getSnapshot().page?.items[0]?.id, id);
  } finally {
    disconnect();
  }
  assert.equal(f.controller.getSnapshot().page, null);
  assert.equal(f.listeners.size, 0);
});
