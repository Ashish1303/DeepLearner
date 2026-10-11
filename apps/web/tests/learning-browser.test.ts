import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLearningBrowserController } from '../src/lib/learning-paths/learning-browser-controller';
import { LearningError } from '../src/lib/api/learning-path-client';
import type { BrowserData } from '../src/lib/learning-paths/contracts';
const result = (title: string): BrowserData => ({
  title,
  description: null,
  crumbs: [],
  items: [],
  totalPages: 2,
});
function deferred() {
  let resolve!: (data: BrowserData) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<BrowserData>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test('superseded delivered-late results and errors cannot replace the new page', async () => {
  for (const fail of [false, true]) {
    const first = deferred(),
      second = deferred();
    let count = 0;
    const signals: AbortSignal[] = [];
    const controller = createLearningBrowserController(
      {
        load: async (_r, _id, _p, signal) => {
          signals.push(signal);
          return ++count === 1 ? first.promise : second.promise;
        },
      },
      'technology',
      'a'.repeat(24),
    );
    const old = controller.load(1);
    const next = controller.load(2, true);
    assert(signals[0]?.aborted);
    second.resolve(result('new'));
    await next;
    if (fail) first.reject(new Error('old secret'));
    else first.resolve(result('old'));
    await old;
    assert.equal(controller.getSnapshot().data?.title, 'new');
    assert.equal(controller.getSnapshot().page, 2);
    assert.equal(controller.getSnapshot().focusRevision, 1);
  }
});
test('cancel clears data and delivered old-identity response cannot populate another controller', async () => {
  const pending = deferred();
  const old = createLearningBrowserController(
    { load: () => pending.promise },
    'path',
    'a'.repeat(24),
  );
  const next = createLearningBrowserController(
    { load: async () => result('new identity') },
    'path',
    'a'.repeat(24),
  );
  const request = old.load();
  old.cancel();
  await next.load();
  pending.resolve(result('old identity'));
  await request;
  assert.equal(old.getSnapshot().data, null);
  assert.equal(old.getSnapshot().status, 'idle');
  assert.equal(next.getSnapshot().data?.title, 'new identity');
});
test('failures clear results; retries are explicit and do not change pagination or focus automatically', async () => {
  let calls = 0;
  const controller = createLearningBrowserController(
    {
      load: async () => {
        if (++calls === 2) throw new LearningError('limited');
        return result('ok');
      },
    },
    'path',
    'a'.repeat(24),
  );
  await controller.load();
  await controller.load(2, true);
  assert.equal(calls, 2);
  assert.equal(controller.getSnapshot().data, null);
  assert.equal(controller.getSnapshot().status, 'error');
  assert.match(controller.getSnapshot().message, /wait/);
  await controller.retry();
  assert.equal(calls, 3);
  assert.equal(controller.getSnapshot().page, 2);
  assert.equal(controller.getSnapshot().focusRevision, 1);
});
