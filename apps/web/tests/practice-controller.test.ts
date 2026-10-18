import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPracticeController } from '../src/lib/practice/practice-controller';
import type {
  PracticeUnlockResult,
  PracticePage,
} from '../src/lib/practice/contracts';
import type { AuthController } from '../src/lib/auth/auth-controller';
import type { PracticeClient } from '../src/lib/api/practice-client';
import { PracticeSubmissionError } from '../src/lib/api/practice-client';
const id = 'a'.repeat(24);
const receipt = {
  id: 'f'.repeat(24),
  attemptNumber: 1,
  result: 'SUBMITTED' as const,
  submittedAt: '2026-10-18T00:00:00.000Z',
};
async function waitForSubmission(c: ReturnType<typeof fixture>, q: string) {
  const end = Date.now() + 2000;
  while (c.getSnapshot().submissions?.[q] !== 'uncertain') {
    if (Date.now() > end) throw Error('submission did not start');
    await new Promise<void>(setImmediate);
  }
}
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
  unlock: (
    ...args: Parameters<PracticeClient['unlock']>
  ) => Promise<Omit<PracticeUnlockResult, 'attempt'>> = async (
    conceptId,
    questionId,
    _answer,
    _token,
    _signal,
    type,
  ) => ({
    id: questionId,
    conceptId,
    type,
    answer: 'Official',
    explanation: null,
  }),
) {
  return createPracticeController(
    {
      load,
      unlock: async (...args) => ({
        ...(await unlock(...args)),
        attempt: receipt,
      }),
    },
    auth,
    account,
    concept,
  );
}
test('F035 four-type reveal is single-question memory and clearing reveals preserves unrelated drafts', async () => {
  let calls = 0;
  const c = fixture(
    typedLoad,
    'one',
    id,
    async (conceptId, questionId, answer, _token, _signal, type) => {
      calls++;
      assert.equal(answer, '\t answer\n ');
      return {
        id: questionId,
        conceptId,
        type,
        answer: 'Official',
        explanation: null,
      };
    },
  );
  const q = page().data[0]!.id;
  await c.load();
  await c.submitAnswer(q);
  assert.equal(calls, 0);
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const) {
    await c.selectType(type);
    c.setDraft(q, '\t answer\n ');
    await c.submitAnswer(q, type);
    assert.equal(c.getSnapshot().reveal?.status, 'ready');
    assert.equal(c.getSnapshot().reveal?.submittedAnswer, '\t answer\n ');
    c.clearDrafts();
    const ticket = c.getSnapshot().clearConfirmation!;
    c.cancelClearDrafts();
    c.confirmClearDrafts(ticket);
    assert.equal(c.getSnapshot().reveal?.status, 'ready');
    c.setDraft(q, 'changed');
    assert.equal(c.getSnapshot().reveal, null);
    c.setDraft(q, '\t answer\n ');
    await c.submitAnswer(q);
    await c.load(2);
    assert.equal(c.getSnapshot().reveal, null);
    await c.load(1);
    assert.equal(c.getSnapshot().drafts[q], '\t answer\n ');
  }
  for (const other of [
    fixture(typedLoad, 'other'),
    fixture(typedLoad, 'one', 'b'.repeat(24)),
  ]) {
    await other.load();
    assert.equal(other.getSnapshot().reveal, null);
    assert.deepEqual(other.getSnapshot().drafts, {});
  }
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  assert.equal(c.getSnapshot().reveal, null);
  assert.deepEqual(c.getSnapshot().drafts, {});
});
test('F035 stale unlock success/error cannot survive edits, navigation, type change, clearing or disposal', async () => {
  const q = page().data[0]!.id;
  for (const fail of [false, true])
    for (const action of ['edit', 'navigate', 'type', 'clear', 'dispose']) {
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      let signal: AbortSignal | undefined,
        calls = 0;
      const c = fixture(
        typedLoad,
        'one',
        id,
        async (conceptId, questionId, _answer, _token, s, type) => {
          calls++;
          signal = s;
          await gate;
          if (fail) throw Error('SECRET');
          return {
            id: questionId,
            conceptId,
            type,
            answer: 'Official',
            explanation: null,
          };
        },
      );
      await c.load();
      c.setDraft(q, 'draft');
      const pending = c.submitAnswer(q);
      await waitForSubmission(c, q);
      await c.submitAnswer(q);
      assert.equal(calls, 1);
      if (action === 'edit') c.setDraft(q, 'edited');
      if (action === 'navigate') await c.load(2);
      if (action === 'type') await c.selectType('CODING');
      if (action === 'clear') {
        c.clearDrafts();
        c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
      }
      if (action === 'dispose') c.cancel();
      assert.equal(signal?.aborted, true);
      release();
      await pending;
      assert.equal(c.getSnapshot().reveal, null);
      assert.doesNotMatch(c.getSnapshot().message, /SECRET/);
    }
});
test('F035 superseded question submission and stale confirmation cannot replace current reveal', async () => {
  const q = page().data[0]!.id,
    second = page(2).data[0]!.id;
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let old: AbortSignal | undefined;
  const c = fixture(
    async () => ({ ...page(), data: [page().data[0]!, page(2).data[0]!] }),
    'one',
    id,
    async (conceptId, questionId, _answer, _token, signal, type) => {
      if (questionId === q) {
        old = signal;
        await gate;
      }
      return {
        id: questionId,
        conceptId,
        type,
        answer: 'Official ' + questionId,
        explanation: null,
      };
    },
  );
  await c.load();
  c.setDraft(q, 'first');
  c.setDraft(second, 'second');
  const pending = c.submitAnswer(q);
  await waitForSubmission(c, q);
  c.clearDrafts();
  const stale = c.getSnapshot().clearConfirmation!;
  c.setDraft(second, 'changed');
  c.confirmClearDrafts(stale);
  await c.submitAnswer(second);
  assert.equal(old?.aborted, true);
  release();
  await pending;
  assert.equal(c.getSnapshot().reveal?.questionId, second);
  assert.equal(c.getSnapshot().reveal?.status, 'ready');
  c.setDraft(q, 'unrelated');
  assert.equal(c.getSnapshot().reveal?.questionId, second);
  c.cancel();
  assert.equal(c.getSnapshot().reveal, null);
});
test('F035 retry is explicit and malformed identities never reveal official content', async () => {
  const q = page().data[0]!.id;
  let calls = 0,
    mode = 'error';
  const c = fixture(
    typedLoad,
    'one',
    id,
    async (conceptId, questionId, _answer, _token, _signal, type) => {
      calls++;
      if (mode === 'error') throw Error('SECRET');
      return {
        id: mode === 'wrong' ? 'b'.repeat(24) : questionId,
        conceptId,
        type,
        answer: 'Official',
        explanation: null,
      };
    },
  );
  await c.load();
  c.setDraft(q, 'answer');
  await c.submitAnswer(q);
  assert.equal(calls, 1);
  assert.equal(c.getSnapshot().reveal?.status, 'error');
  assert.doesNotMatch(c.getSnapshot().reveal!.message, /SECRET/);
  mode = 'wrong';
  await c.submitAnswer(q);
  assert.equal(c.getSnapshot().reveal?.result, null);
  mode = 'ok';
  await c.submitAnswer(q);
  assert.equal(c.getSnapshot().reveal?.status, 'ready');
  assert.equal(calls, 3);
  await c.submitAnswer(q, 'CODING');
  assert.equal(calls, 3);
});
test('F036 uncertain retries retain a key across navigation, success requires an explicit new key', async () => {
  const keys: string[] = [];
  let mode = 'uncertain';
  const c = fixture(
    typedLoad,
    'one',
    id,
    async (
      conceptId,
      questionId,
      _answer,
      _token,
      _signal,
      type,
      submission,
    ) => {
      keys.push(submission.key);
      if (mode === 'uncertain') throw Error('network');
      return {
        id: questionId,
        conceptId,
        type,
        answer: 'Official',
        explanation: null,
      };
    },
  );
  const q = page().data[0]!.id;
  await c.load();
  c.setDraft(q, 'unchanged');
  await c.submitAnswer(q);
  assert.equal(c.getSnapshot().reveal?.status, 'error');
  await c.load(2);
  await c.load(1);
  await c.submitAnswer(q);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  mode = 'saved';
  await c.submitAnswer(q);
  assert.equal(keys[1], keys[2]);
  assert.equal(c.getSnapshot().submissions?.[q], 'saved');
  await c.submitAnswer(q);
  assert.notEqual(keys[2], keys[3]);
  c.setDraft(q, 'edited');
  await c.submitAnswer(q);
  assert.notEqual(keys[3], keys[4]);
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  assert.deepEqual(c.getSnapshot().submissions, {});
  assert.equal(c.getSnapshot().reveal, null);
});
test('F036 cancellation while hashing cannot send or retain a submission for a disposed identity', async () => {
  let calls = 0;
  const c = fixture(
    typedLoad,
    'one',
    id,
    async (conceptId, questionId, _a, _t, _s, type) => {
      calls++;
      return {
        id: questionId,
        conceptId,
        type,
        answer: 'Official',
        explanation: null,
      };
    },
  );
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'answer');
  const pending = c.submitAnswer(q);
  c.cancel();
  await pending;
  assert.equal(calls, 0);
  assert.deepEqual(c.getSnapshot().submissions, {});
});
test('F036 refused keys never silently rotate and a new submission requires an explicit action', async () => {
  const keys: string[] = [];
  let refuse = true;
  let loads = 0;
  const load: PracticeClient['load'] = async (...args) => {
    loads++;
    return typedLoad(...args);
  };
  const c = fixture(
    load,
    'one',
    id,
    async (conceptId, questionId, _a, _t, _s, type, submission) => {
      keys.push(submission.key);
      if (refuse)
        throw new PracticeSubmissionError('PRACTICE_IDEMPOTENCY_CONFLICT', 409);
      return {
        id: questionId,
        conceptId,
        type,
        answer: 'Official',
        explanation: null,
      };
    },
  );
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'answer');
  await c.submitAnswer(q);
  assert.equal(c.getSnapshot().submissions?.[q], 'refused');
  await c.submitAnswer(q);
  assert.equal(keys.length, 1);
  await c.startNewSubmission(q);
  assert.equal(loads, 2);
  assert.equal(c.getSnapshot().status, 'ready');
  assert.equal(c.getSnapshot().focusRevision, 1);
  refuse = false;
  await c.submitAnswer(q);
  assert.notEqual(keys[0], keys[1]);
});
test('F036 retry memos share the 100-draft capacity across all four types and clear with their scope', async () => {
  const c = fixture(typedLoad),
    types = ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const;
  for (const type of types) {
    await c.selectType(type);
    for (let n = 1; n <= 25; n++) {
      await c.load(n);
      const q = c.getSnapshot().data!.data[0]!.id;
      c.setDraft(q, 'answer');
      await c.submitAnswer(q);
    }
    assert.equal(Object.keys(c.getSnapshot().submissions!).length, 25);
  }
  await c.load(26);
  const q = c.getSnapshot().data!.data[0]!.id;
  c.setDraft(q, 'blocked');
  assert.match(c.getSnapshot().notice, /capacity/);
  await c.submitAnswer(q);
  assert.equal(Object.keys(c.getSnapshot().submissions!).length, 25);
  c.clearDrafts();
  const ticket = c.getSnapshot().clearConfirmation!;
  c.cancelClearDrafts();
  c.confirmClearDrafts(ticket);
  assert.equal(Object.keys(c.getSnapshot().submissions!).length, 25);
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  for (const type of types) {
    await c.selectType(type);
    assert.deepEqual(c.getSnapshot().submissions, {});
  }
});
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
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
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

const typedLoad: PracticeClient['load'] = async (
  _id,
  n,
  _token,
  _signal,
  type = 'OUTPUT',
) => ({ ...page(n), data: page(n).data.map((item) => ({ ...item, type })) });

test('F034 empty code drafts preserve whitespace and four-type scoped confirmation', async () => {
  const load: PracticeClient['load'] = async (...args) => {
    const result = await typedLoad(...args);
    return {
      ...result,
      data: result.data.map((item) => ({
        ...item,
        starterCode: '\tconst starter = 1;\n',
        language: 'JAVASCRIPT' as const,
      })),
    };
  };
  const c = fixture(load),
    other = fixture(load, 'other'),
    concept = fixture(load, 'one', 'b'.repeat(24));
  const types = ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const;
  const q = page().data[0]!.id;
  for (const owner of [c, other, concept]) {
    await owner.load();
    for (const type of types) {
      await owner.selectType(type);
      assert.equal(owner.getSnapshot().drafts[q], undefined);
      owner.setDraft(q, '\t  ' + type + '\n\n  ');
    }
  }
  for (const type of types) {
    await c.selectType(type);
    assert.equal(c.getSnapshot().drafts[q], '\t  ' + type + '\n\n  ');
  }
  c.clearDrafts();
  const canceled = c.getSnapshot().clearConfirmation!;
  c.cancelClearDrafts();
  c.confirmClearDrafts(canceled);
  assert.equal(c.getSnapshot().drafts[q], '\t  CODING\n\n  ');
  c.clearDrafts();
  const stale = c.getSnapshot().clearConfirmation!;
  c.setDraft(q, ' \t\n');
  c.confirmClearDrafts(stale);
  assert.equal(c.getSnapshot().drafts[q], ' \t\n');
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  for (const type of types) {
    await c.selectType(type);
    assert.deepEqual(c.getSnapshot().drafts, {});
    for (const owner of [other, concept]) {
      await owner.selectType(type);
      assert.equal(owner.getSnapshot().drafts[q], '\t  ' + type + '\n\n  ');
    }
  }
});

test('F034 shared four-type capacity and code length never evict or trim', async () => {
  const c = fixture(typedLoad);
  await c.load();
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING'] as const) {
    await c.selectType(type);
    for (let n = 1; n <= 25; n++) {
      await c.load(n);
      c.setDraft(page(n).data[0]!.id, type);
    }
  }
  await c.load(26);
  const next = page(26).data[0]!.id;
  c.setDraft(next, '101st');
  assert.equal(c.getSnapshot().drafts[next], undefined);
  assert.match(c.getSnapshot().notice, /capacity/);
  await c.load(1);
  const q = page().data[0]!.id;
  const code = '\t' + ' '.repeat(9998) + '\n';
  c.setDraft(q, code);
  c.setDraft(q, code + 'x');
  assert.equal(c.getSnapshot().drafts[q], code);
  c.setDraft(q, 'wrong type', 'OUTPUT');
  assert.equal(c.getSnapshot().drafts[q], code);
  c.setDraft(q, '');
  await c.load(26);
  c.setDraft(next, 'freed slot');
  assert.equal(c.getSnapshot().drafts[next], 'freed slot');
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO'] as const) {
    await c.selectType(type);
    assert.equal(Object.keys(c.getSnapshot().drafts).length, 25);
    assert.equal(c.getSnapshot().drafts[q], type);
  }
});

test('F034 stale Coding success/error and old confirmations cannot replace current identity', async () => {
  for (const fail of [false, true]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let hold = false,
      oldSignal: AbortSignal | undefined;
    const c = fixture(async (...args) => {
      if (hold && args[4] === 'CODING') {
        oldSignal = args[3];
        await gate;
        if (fail) throw Error('obsolete');
      }
      return typedLoad(...args);
    });
    await c.load();
    const q = page().data[0]!.id;
    c.setDraft(q, 'output');
    await c.selectType('CODING');
    c.setDraft(q, 'coding');
    c.clearDrafts();
    const oldTicket = c.getSnapshot().clearConfirmation!;
    await c.load(2);
    hold = true;
    const pending = c.load(1);
    const revision = c.getSnapshot().focusRevision;
    await c.selectType('OUTPUT');
    assert.equal(c.getSnapshot().page, 1);
    assert.equal(c.getSnapshot().focusRevision, revision);
    assert.equal(oldSignal?.aborted, true);
    c.confirmClearDrafts(oldTicket);
    release();
    await pending;
    assert.equal(c.getSnapshot().type, 'OUTPUT');
    assert.equal(c.getSnapshot().status, 'ready');
    assert.equal(c.getSnapshot().drafts[q], 'output');
    hold = false;
    await c.selectType('CODING');
    assert.equal(c.getSnapshot().drafts[q], 'coding');
    c.clearDrafts();
    const disposed = c.getSnapshot().clearConfirmation!;
    c.cancel();
    await c.selectType('CODING');
    assert.deepEqual(c.getSnapshot().drafts, {});
    c.setDraft(q, 'new lifetime');
    c.confirmClearDrafts(disposed);
    assert.equal(c.getSnapshot().drafts[q], 'new lifetime');
  }
});

test('F033 three-type round trips retain drafts and only confirmed current-scope clearing deletes them', async () => {
  let calls = 0;
  const c = fixture(async (...args) => {
    calls++;
    return typedLoad(...args);
  });
  const otherAccount = fixture(typedLoad, 'other');
  const otherConcept = fixture(typedLoad, 'one', 'b'.repeat(24));
  const types = ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO'] as const;
  const q = page().data[0]!.id;
  for (const owner of [c, otherAccount, otherConcept]) {
    await owner.load();
    for (const type of types) {
      await owner.selectType(type);
      owner.setDraft(q, '  ' + type + '\n');
    }
  }
  for (const type of types) {
    await c.load(2);
    const revision = c.getSnapshot().focusRevision;
    await c.selectType(type);
    assert.equal(c.getSnapshot().page, 1);
    assert.equal(c.getSnapshot().focusRevision, revision);
    assert.equal(c.getSnapshot().drafts[q], '  ' + type + '\n');
    const before = calls;
    await c.selectType(type);
    await c.selectType('CODING_BASED' as 'OUTPUT');
    assert.equal(calls, before);
  }
  c.clearDrafts();
  const canceled = c.getSnapshot().clearConfirmation!;
  c.cancelClearDrafts();
  c.confirmClearDrafts(canceled);
  assert.equal(c.getSnapshot().drafts[q], '  SCENARIO\n');
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  for (const type of types) {
    await c.selectType(type);
    assert.deepEqual(c.getSnapshot().drafts, {});
    for (const other of [otherAccount, otherConcept]) {
      await other.selectType(type);
      assert.equal(other.getSnapshot().drafts[q], '  ' + type + '\n');
    }
  }
});

test('F033 capacity and length are shared across three stores without eviction', async () => {
  const c = fixture(typedLoad);
  await c.load();
  for (const [type, count] of [
    ['OUTPUT', 34],
    ['DESCRIPTIVE', 33],
    ['SCENARIO', 33],
  ] as const) {
    await c.selectType(type);
    for (let n = 1; n <= count; n++) {
      await c.load(n);
      c.setDraft(page(n).data[0]!.id, type);
    }
  }
  await c.load(34);
  c.setDraft(page(34).data[0]!.id, '101st');
  assert.match(c.getSnapshot().notice, /capacity/);
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 33);
  await c.load(1);
  const q = page().data[0]!.id;
  c.setDraft(q, 'x'.repeat(10000));
  c.setDraft(q, 'x'.repeat(10001));
  assert.equal(c.getSnapshot().drafts[q]?.length, 10000);
  c.setDraft(q, 'old event', 'OUTPUT');
  assert.equal(c.getSnapshot().drafts[q]?.length, 10000);
  c.setDraft(q, '');
  await c.load(34);
  c.setDraft(page(34).data[0]!.id, 'slot freed');
  assert.equal(c.getSnapshot().drafts[page(34).data[0]!.id], 'slot freed');
  await c.selectType('OUTPUT');
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 34);
  assert.equal(c.getSnapshot().drafts[q], 'OUTPUT');
  await c.selectType('DESCRIPTIVE');
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 33);
});

test('F033 stale Scenario success/error, confirmation and disposed callbacks cannot cross identities', async () => {
  for (const fail of [false, true]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    let signal: AbortSignal | undefined;
    const c = fixture(async (...args) => {
      if (held && args[4] === 'SCENARIO') {
        signal = args[3];
        await gate;
        if (fail) throw Error('obsolete');
      }
      return typedLoad(...args);
    });
    await c.load();
    const q = page().data[0]!.id;
    c.setDraft(q, 'output');
    await c.selectType('SCENARIO');
    c.setDraft(q, 'scenario');
    c.clearDrafts();
    const oldTicket = c.getSnapshot().clearConfirmation!;
    await c.selectType('DESCRIPTIVE');
    c.setDraft(q, 'description');
    held = true;
    const pending = c.selectType('SCENARIO');
    assert.equal(c.getSnapshot().status, 'loading');
    assert.equal(c.getSnapshot().data, null);
    await c.selectType('OUTPUT');
    c.confirmClearDrafts(oldTicket);
    assert.equal(signal?.aborted, true);
    release();
    await pending;
    assert.equal(c.getSnapshot().type, 'OUTPUT');
    assert.equal(c.getSnapshot().drafts[q], 'output');
    assert.equal(c.getSnapshot().status, 'ready');
    c.clearDrafts();
    const disposalTicket = c.getSnapshot().clearConfirmation!;
    c.cancel();
    c.confirmClearDrafts(disposalTicket);
    held = false;
    for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO'] as const) {
      await c.selectType(type);
      assert.deepEqual(c.getSnapshot().drafts, {});
    }
  }
});

test('F033 Scenario fingerprint changes clear only its draft and edits invalidate confirmation', async () => {
  let prompt = 'Scenario';
  const c = fixture(async (...args) => {
    const data = await typedLoad(...args);
    return args[4] === 'SCENARIO'
      ? { ...data, data: data.data.map((item) => ({ ...item, prompt })) }
      : data;
  });
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'output');
  await c.selectType('DESCRIPTIVE');
  c.setDraft(q, 'description');
  await c.selectType('SCENARIO');
  c.setDraft(q, 'scenario');
  c.clearDrafts();
  const ticket = c.getSnapshot().clearConfirmation!;
  c.setDraft(q, 'changed draft');
  c.confirmClearDrafts(ticket);
  assert.equal(c.getSnapshot().drafts[q], 'changed draft');
  prompt = 'Changed context';
  await c.retry();
  assert.deepEqual(c.getSnapshot().drafts, {});
  assert.match(c.getSnapshot().notice, /content changed/);
  await c.selectType('OUTPUT');
  assert.equal(c.getSnapshot().drafts[q], 'output');
  await c.selectType('DESCRIPTIVE');
  assert.equal(c.getSnapshot().drafts[q], 'description');
});
test('F032 type round trips retain separate drafts for identical IDs and reset pages', async () => {
  let calls = 0;
  const c = fixture(async (...args) => {
    calls++;
    return typedLoad(...args);
  });
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'output');
  await c.load(2);
  await c.selectType('DESCRIPTIVE');
  assert.equal(c.getSnapshot().page, 1);
  assert.deepEqual(c.getSnapshot().drafts, {});
  c.setDraft(q, 'descriptive');
  await c.selectType('OUTPUT');
  assert.equal(c.getSnapshot().drafts[q], 'output');
  await c.selectType('DESCRIPTIVE');
  assert.equal(c.getSnapshot().drafts[q], 'descriptive');
  const before = calls;
  await c.selectType('DESCRIPTIVE');
  assert.equal(calls, before);
  c.clearDrafts();
  const ticket = c.getSnapshot().clearConfirmation!;
  assert.equal(c.getSnapshot().drafts[q], 'descriptive');
  c.cancelClearDrafts();
  c.confirmClearDrafts(ticket);
  assert.equal(c.getSnapshot().drafts[q], 'descriptive');
  c.clearDrafts();
  c.confirmClearDrafts(c.getSnapshot().clearConfirmation!);
  assert.deepEqual(c.getSnapshot().drafts, {});
  await c.selectType('OUTPUT');
  assert.deepEqual(c.getSnapshot().drafts, {});
});
test('F032 capacity is shared across types, with no eviction or partial clearing', async () => {
  const c = fixture(typedLoad);
  for (const type of ['OUTPUT', 'DESCRIPTIVE'] as const) {
    await c.selectType(type);
    for (let n = 1; n <= 50; n++) {
      await c.load(n);
      c.setDraft(page(n).data[0]!.id, type);
    }
  }
  await c.load(51);
  c.setDraft(page(51).data[0]!.id, 'overflow');
  assert.match(c.getSnapshot().notice, /capacity/);
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 50);
  await c.selectType('OUTPUT');
  assert.equal(Object.keys(c.getSnapshot().drafts).length, 50);
  c.setDraft(page().data[0]!.id, '');
  await c.selectType('DESCRIPTIVE');
  await c.load(51);
  c.setDraft(page(51).data[0]!.id, 'x'.repeat(10000));
  assert.equal(c.getSnapshot().drafts[page(51).data[0]!.id]?.length, 10000);
});
test('F032 type races suppress stale success/error and invalidate pending clear confirmation', async () => {
  for (const fail of [false, true]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = false;
    let oldSignal: AbortSignal | undefined;
    const c = fixture(async (...args) => {
      if (held && args[4] === 'DESCRIPTIVE') {
        oldSignal = args[3];
        await gate;
        if (fail) throw Error('obsolete');
      }
      return typedLoad(...args);
    });
    await c.load();
    const q = page().data[0]!.id;
    c.setDraft(q, 'keep');
    c.clearDrafts();
    const ticket = c.getSnapshot().clearConfirmation!;
    held = true;
    const pending = c.selectType('DESCRIPTIVE');
    await c.selectType('OUTPUT');
    c.confirmClearDrafts(ticket);
    assert.equal(oldSignal?.aborted, true);
    release();
    await pending;
    assert.equal(c.getSnapshot().type, 'OUTPUT');
    assert.equal(c.getSnapshot().status, 'ready');
    assert.equal(c.getSnapshot().drafts[q], 'keep');
    c.clearDrafts();
    const discarded = c.getSnapshot().clearConfirmation!;
    c.cancel();
    await c.load();
    c.setDraft(q, 'new lifetime');
    c.confirmClearDrafts(discarded);
    assert.equal(c.getSnapshot().drafts[q], 'new lifetime');
  }
});
test('F032 disposal clears both types and pending confirmation cannot affect another identity', async () => {
  const a = fixture(typedLoad),
    b = fixture(typedLoad, 'other');
  for (const c of [a, b]) {
    await c.load();
    c.setDraft(page().data[0]!.id, 'output');
    await c.selectType('DESCRIPTIVE');
    c.setDraft(page().data[0]!.id, 'description');
  }
  a.clearDrafts();
  const ticket = a.getSnapshot().clearConfirmation!;
  a.cancel();
  a.confirmClearDrafts(ticket);
  await a.selectType('DESCRIPTIVE');
  assert.deepEqual(a.getSnapshot().drafts, {});
  assert.equal(b.getSnapshot().drafts[page().data[0]!.id], 'description');
});

test('F032 confirmation cannot be bypassed and stale typed edit cannot change current draft', async () => {
  const c = fixture(typedLoad);
  await c.load();
  const q = page().data[0]!.id;
  c.setDraft(q, 'keep');
  c.confirmClearDrafts(null as unknown as number);
  assert.equal(c.getSnapshot().drafts[q], 'keep');
  await c.selectType('DESCRIPTIVE');
  c.setDraft(q, 'description');
  c.setDraft(q, 'old event', 'OUTPUT');
  assert.equal(c.getSnapshot().drafts[q], 'description');
  c.clearDrafts();
  const ticket = c.getSnapshot().clearConfirmation!;
  await c.retry();
  c.confirmClearDrafts(ticket);
  assert.equal(c.getSnapshot().drafts[q], 'description');
});
