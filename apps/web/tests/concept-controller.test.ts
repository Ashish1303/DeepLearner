import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createConceptController } from '../src/lib/concepts/concept-controller';
import { ConceptError } from '../src/lib/api/concept-client';
import type { ConceptData } from '../src/lib/concepts/contracts';
const data = (title: string): ConceptData => ({
  topic: {
    id: 'd'.repeat(24),
    moduleId: 'c'.repeat(24),
    learningPathId: 'b'.repeat(24),
    technologyId: 'a'.repeat(24),
    title,
    slug: 'topic',
    description: null,
    order: 0,
  },
  concept: null,
  crumbs: [],
  items: [],
  totalPages: 0,
});
function fixture() {
  const requests: {
    signal: AbortSignal;
    resolve: (data: ConceptData) => void;
    reject: (error: Error) => void;
    page: number;
  }[] = [];
  const controller = createConceptController(
    {
      load: async (_resource, _id, page, signal) =>
        new Promise((resolve, reject) =>
          requests.push({ signal, page, resolve, reject }),
        ),
    },
    'topic',
    'd'.repeat(24),
  );
  return { controller, requests };
}
test('new request clears content and rejects delivered-late successes and failures', async () => {
  for (const failure of [false, true]) {
    const { controller, requests } = fixture();
    const old = controller.load();
    const current = controller.load(2, true);
    assert(requests[0]!.signal.aborted);
    assert.equal(controller.getSnapshot().data, null);
    requests[1]!.resolve(data('Current'));
    await current;
    if (failure) requests[0]!.reject(new Error('obsolete private failure'));
    else requests[0]!.resolve(data('Obsolete'));
    await old;
    assert.equal(controller.getSnapshot().data?.topic.title, 'Current');
    assert.equal(controller.getSnapshot().message, '');
    assert.equal(controller.getSnapshot().focusRevision, 1);
  }
});
test('cancel clears content and suppresses both late result kinds without assuming fetch honors abort', async () => {
  for (const failure of [false, true]) {
    const { controller, requests } = fixture();
    const pending = controller.load();
    controller.cancel();
    assert(requests[0]!.signal.aborted);
    if (failure) requests[0]!.reject(new Error('late'));
    else requests[0]!.resolve(data('Late'));
    await pending;
    assert.equal(controller.getSnapshot().status, 'idle');
    assert.equal(controller.getSnapshot().data, null);
  }
});
test('separate account/resource owners cannot receive the disposed owner result', async () => {
  const old = fixture(),
    next = fixture();
  const a = old.controller.load();
  old.controller.cancel();
  const b = next.controller.load();
  next.requests[0]!.resolve(data('New account'));
  await b;
  old.requests[0]!.resolve(data('Old account'));
  await a;
  assert.equal(old.controller.getSnapshot().data, null);
  assert.equal(next.controller.getSnapshot().data?.topic.title, 'New account');
});
test('Retry is explicit, stays on requested page and advances focus only after settling', async () => {
  const { controller, requests } = fixture();
  const first = controller.load(2, true);
  requests[0]!.reject(new ConceptError('unavailable'));
  await first;
  assert.equal(requests.length, 1);
  assert.equal(controller.getSnapshot().status, 'error');
  const retry = controller.retry();
  assert.equal(requests[1]!.page, 2);
  assert.equal(controller.getSnapshot().data, null);
  requests[1]!.resolve(data('Recovered'));
  await retry;
  assert.equal(controller.getSnapshot().focusRevision, 2);
  assert.equal(controller.getSnapshot().status, 'ready');
});
test('subscription cleanup, unsafe pages and safe error fallback', async () => {
  const { controller, requests } = fixture();
  let notifications = 0;
  const unsubscribe = controller.subscribe(() => notifications++);
  await controller.load(0);
  await controller.load(Number.MAX_SAFE_INTEGER);
  assert.equal(requests.length, 0);
  const pending = controller.load();
  requests[0]!.reject(new Error('private'));
  await pending;
  assert(!controller.getSnapshot().message.includes('private'));
  assert.equal(notifications, 2);
  unsubscribe();
  controller.cancel();
  assert.equal(notifications, 2);
});

test('Example payloads cannot survive cancellation or replace a new owner after delayed success/failure', async () => {
  const withExamples = (title: string): ConceptData => ({
    ...data(title),
    concept: {
      id: 'e'.repeat(24),
      topicId: 'd'.repeat(24),
      moduleId: 'c'.repeat(24),
      learningPathId: 'b'.repeat(24),
      technologyId: 'a'.repeat(24),
      title,
      slug: 'concept',
      difficulty: 'BEGINNER',
      order: 0,
      contentFormat: 'MARKDOWN',
      schemaVersion: 1,
      read: { summary: title, bodyMarkdown: 'Read' },
      source: {
        label: 'Source',
        url: 'https://example.invalid',
        sourceType: 'OFFICIAL_OR_TRUSTED',
        isOfficial: false,
      },
      examples: [{ title, bodyMarkdown: title }],
    },
  });
  for (const failure of [false, true]) {
    const old = fixture(),
      next = fixture();
    const a = old.controller.load();
    old.controller.cancel();
    const b = next.controller.load();
    next.requests[0]!.resolve(withExamples('Current example'));
    await b;
    if (failure) old.requests[0]!.reject(new Error('Old private example'));
    else old.requests[0]!.resolve(withExamples('Old example'));
    await a;
    assert(old.requests[0]!.signal.aborted);
    assert.equal(old.controller.getSnapshot().data, null);
    assert.equal(
      next.controller.getSnapshot().data?.concept?.examples[0]?.title,
      'Current example',
    );
    assert.equal(next.controller.getSnapshot().message, '');
    const pending = next.controller.load();
    assert.equal(next.controller.getSnapshot().data, null);
    next.controller.cancel();
    next.requests[1]!.resolve(withExamples('After unmount'));
    await pending;
    assert.equal(next.controller.getSnapshot().data, null);
  }
});
