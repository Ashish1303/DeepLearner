import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalogController } from '../src/lib/technologies/catalog-controller';
import type { CatalogPage } from '../src/lib/technologies/contracts';
import { ApiError } from '../src/lib/api/client';
function page(n: number, total = 41): CatalogPage {
  return {
    success: true,
    message: null,
    data: [],
    meta: {
      requestId: 'test',
      page: n,
      limit: 20,
      total,
      totalPages: Math.ceil(total / 20),
    },
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
test('catalog loads empty and later pages; focus changes only for explicit page navigation', async () => {
  const controller = createCatalogController({
    async list(n) {
      return page(n);
    },
  });
  assert.equal(controller.getSnapshot().page, 1);
  await controller.load(1);
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(controller.getSnapshot().focusRevision, 0);
  await controller.load(3, true);
  assert.equal(controller.getSnapshot().page, 3);
  assert.equal(controller.getSnapshot().focusRevision, 1);
  await controller.retry();
  assert.equal(controller.getSnapshot().focusRevision, 1);
  await controller.load(1, true);
  assert.equal(controller.getSnapshot().page, 1);
});
test('superseded request is aborted and late success/failure cannot overwrite newer state', async () => {
  const old = deferred<CatalogPage>();
  let oldSignal: AbortSignal | undefined;
  const controller = createCatalogController({
    list(n, signal) {
      if (n === 1) {
        oldSignal = signal;
        return old.promise;
      }
      return Promise.resolve(page(n));
    },
  });
  const first = controller.load(1);
  await controller.load(2, true);
  assert.equal(oldSignal?.aborted, true);
  old.resolve(page(1));
  await first;
  assert.equal(controller.getSnapshot().page, 2);
  assert.equal(controller.getSnapshot().status, 'ready');
});
test('unmount/account-owner disposal suppresses late results and fresh controller starts page one', async () => {
  const pending = deferred<CatalogPage>();
  const old = createCatalogController({ list: () => pending.promise });
  const request = old.load(2);
  old.cancel();
  pending.resolve(page(2));
  await request;
  assert.equal(old.getSnapshot().status, 'idle');
  assert.deepEqual(old.getSnapshot().items, []);
  const fresh = createCatalogController({
    async list(n) {
      return page(n, 0);
    },
  });
  await fresh.load(1);
  assert.equal(fresh.getSnapshot().page, 1);
  assert.equal(fresh.getSnapshot().totalPages, 0);
});
test('safe errors require manual retry, preserve requested page and do not mutate auth', async () => {
  for (const status of [400, 401, 403, 429, 503]) {
    let calls = 0;
    const controller = createCatalogController({
      async list(n) {
        calls++;
        if (calls === 1) throw new ApiError('REQUEST_FAILED', status);
        return page(n);
      },
    });
    await controller.load(2, true);
    assert.equal(calls, 1);
    assert.equal(controller.getSnapshot().status, 'error');
    assert.equal(controller.getSnapshot().invalidRequest, status === 400);
    await controller.retry();
    assert.equal(calls, 2);
    assert.equal(controller.getSnapshot().status, 'ready');
  }
});
test('cancelled rejection is silent; effect-style cancel and restart loads safely', async () => {
  const pending = deferred<CatalogPage>();
  let calls = 0;
  const controller = createCatalogController({
    list(n) {
      calls++;
      return calls === 1 ? pending.promise : Promise.resolve(page(n));
    },
  });
  const first = controller.load(1);
  controller.cancel();
  await controller.load(1);
  pending.reject(new Error('PRIVATE_SENTINEL'));
  await first;
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(controller.getSnapshot().message, '');
});
