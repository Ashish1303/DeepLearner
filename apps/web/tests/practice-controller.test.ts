import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPracticeController } from '../src/lib/practice/practice-controller';
import type { PracticePage } from '../src/lib/practice/contracts';
import type { AuthController } from '../src/lib/auth/auth-controller';
import type { PracticeClient } from '../src/lib/api/practice-client';
const id = 'a'.repeat(24);
const page = (number = 1, prompt = 'Predict'): PracticePage => ({
  success: true,
  message: null,
  data: [
    {
      id: number.toString(16).padStart(24, '0'),
      conceptId: id,
      type: 'OUTPUT',
      difficulty: 'BEGINNER',
      prompt,
      starterCode: null,
      language: null,
    },
  ],
  meta: {
    requestId: 'test',
    page: number,
    limit: 10,
    total: 1100,
    totalPages: 110,
  },
});
const auth: Pick<AuthController, 'runAuthenticatedRead'> = {
  runAuthenticatedRead: async (_account, signal, work) =>
    work('synthetic', signal),
};
function fixture(
  load: PracticeClient['load'] = async (_id, n) => page(n),
  account = 'one',
  concept = id,
) {
  return createPracticeController({ load }, auth, account, concept);
}
test('drafts retain exact whitespace across pages/retry and clear on changed question content', async () => {
  let prompt = 'Predict';
  const c = fixture(async (_id, n) => page(n, prompt));
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, '  answer\n');
  await c.load(2);
  await c.load(1);
  assert.equal(c.getSnapshot().drafts[q], '  answer\n');
  await c.retry();
  assert.equal(c.getSnapshot().drafts[q], '  answer\n');
  prompt = 'Changed';
  await c.retry();
  assert.equal(c.getSnapshot().drafts[q], undefined);
  assert.match(c.getSnapshot().notice, /changed/);
});
test('draft capacity and length never silently evict existing work', async () => {
  const c = fixture();
  for (let n = 1; n <= 100; n++) {
    await c.load(n);
    c.setDraft(page(n).data[0]!.id, 'x');
  }
  await c.load(101);
  const q = page(101).data[0]!.id;
  c.setDraft(q, 'new');
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 100);
  assert.match(c.getSnapshot().notice, /capacity/);
  await c.load(1);
  const first = page().data[0]!.id;
  c.setDraft(first, 'x'.repeat(10000));
  assert.equal(c.getSnapshot().drafts[first]?.length, 10000);
  c.setDraft(first, 'x'.repeat(10001));
  assert.equal(c.getSnapshot().drafts[first]?.length, 10000);
  c.setDraft(first, '');
  await c.load(101);
  c.setDraft(q, 'new');
  assert.equal(c.getSnapshot().drafts[q], 'new');
  c.clearDrafts();
  assert.deepEqual(c.getSnapshot().drafts, {});
});
test('separate account/Concept instances and unmount erase drafts and cancel work', async () => {
  const a = fixture();
  await a.load();
  a.setDraft(page().data[0]!.id, 'secret');
  for (const b of [
    fixture(undefined, 'two'),
    fixture(undefined, 'one', 'b'.repeat(24)),
  ]) {
    await b.load();
    assert.deepEqual(b.getSnapshot().drafts, {});
  }
  a.cancel();
  assert.deepEqual(a.getSnapshot().drafts, {});
  assert.equal(a.getSnapshot().data, null);
});
test('replacement request aborts stale success/error and only latest request updates focus', async () => {
  for (const fail of [false, true]) {
    let release!: () => void;
    let signal: AbortSignal | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const c = fixture(async (_id, n, _token, s) => {
      if (n === 1) {
        signal = s;
        await gate;
        if (fail) throw new Error('old');
      }
      return page(n);
    });
    const old = c.load();
    await c.load(2, true);
    assert.equal(signal?.aborted, true);
    release();
    await old;
    assert.equal(c.getSnapshot().page, 2);
    assert.equal(c.getSnapshot().status, 'ready');
    assert.equal(c.getSnapshot().focusRevision, 1);
  }
});
test('loading/error clear items, retry retains drafts, unknown question edits are ignored', async () => {
  let fail = false;
  const c = fixture(async () => {
    if (fail) throw new Error('secret');
    return page();
  });
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'draft');
  c.setDraft('unknown', 'not stored');
  fail = true;
  const pending = c.retry();
  assert.equal(c.getSnapshot().data, null);
  await pending;
  assert.equal(c.getSnapshot().status, 'error');
  assert.equal(c.getSnapshot().message.includes('secret'), false);
  assert.equal(c.getSnapshot().drafts[q], 'draft');
  fail = false;
  await c.retry();
  assert.equal(c.getSnapshot().status, 'ready');
  assert.deepEqual(c.getSnapshot().drafts, { [q]: 'draft' });
});
