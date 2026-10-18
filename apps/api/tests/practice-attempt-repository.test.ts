import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { MongoClient, MongoInvalidArgumentError } from 'mongodb';
import {
  createPracticeAttemptRepository,
  verifyAttemptIndexes,
  type AttemptStore,
} from '../src/modules/practice/practice-attempt.repository.js';
import {
  attemptIndexes,
  type AttemptRecord,
} from '../src/modules/practice/practice-attempt.model.js';
import type { QualifiedPractice } from '../src/modules/practice/practice.dto.js';
const user = 'a'.repeat(24),
  question = 'b'.repeat(24),
  concept = 'c'.repeat(24);
const input = {
  questionId: question,
  conceptId: concept,
  studentAnswer: '\t answer\n ',
  questionRevision: 'd'.repeat(64),
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};
function fixture() {
  const state = {
    rows: [] as AttemptRecord[],
    pending: [] as AttemptRecord[],
    events: [] as string[],
    content: {
      data: {
        id: question,
        conceptId: concept,
        type: 'OUTPUT',
        answer: 'PRIVATE',
        explanation: null,
      },
      questionRevision: input.questionRevision,
      contentFingerprint: 'e'.repeat(64),
    } as QualifiedPractice | null,
    proofFault: false,
    unknownCommit: false,
    cleanupFault: false,
    duplicate: 0,
    bodyRuns: 1,
    now: 0,
    options: {} as Record<string, unknown>,
  };
  const session = {
    async withTransaction(
      fn: () => Promise<void>,
      options: Record<string, unknown>,
    ) {
      state.options = options;
      try {
        for (let i = 0; i < state.bodyRuns; i++) {
          state.pending = [];
          await fn();
        }
        state.rows.push(...state.pending);
        state.pending = [];
        state.events.push('commit');
        if (state.unknownCommit)
          throw { errorLabels: ['UnknownTransactionCommitResult'] };
      } catch (error) {
        state.pending = [];
        throw error;
      }
    },
    async endSession() {
      state.events.push('closed');
      if (state.cleanupFault) throw Error('private');
    },
  } as unknown as ClientSession;
  const store: AttemptStore = {
    async ready() {
      state.events.push('ready');
    },
    async session() {
      return session;
    },
    async qualified(_q, _c, actual, ms, majority) {
      assert.equal(actual, session);
      if (majority) assert(ms !== undefined && ms > 0 && ms <= 10_000);
      else assert.equal(ms, undefined);
      state.events.push(majority ? 'fresh' : 'snapshot');
      return state.content;
    },
    async byKey(owner, key, actual) {
      assert.equal(actual, session);
      assert.equal(arguments.length, 3);
      return (
        state.rows.find(
          (row) => row.userId.equals(owner) && row.idempotencyKeyHash === key,
        ) ?? null
      );
    },
    async last(owner, q, actual) {
      assert.equal(actual, session);
      assert.equal(arguments.length, 3);
      return Math.max(
        0,
        ...state.rows
          .filter((row) => row.userId.equals(owner) && row.questionId.equals(q))
          .map((row) => row.attemptNumber),
      );
    },
    async insert(row, actual) {
      assert.equal(actual, session);
      state.events.push('insert');
      if (state.duplicate-- > 0)
        throw { code: 11000, keyPattern: attemptIndexes[0].key };
      state.pending.push(row);
    },
    async proof(id, owner, key, actual, ms) {
      assert.equal(actual, session);
      assert(ms > 0 && ms <= 10_000);
      state.events.push('proof');
      return state.proofFault
        ? null
        : state.rows.find(
            (row) =>
              row._id.equals(id) &&
              row.userId.equals(owner) &&
              row.idempotencyKeyHash === key,
          );
    },
  };
  return {
    state,
    store,
    repo: createPracticeAttemptRepository(store, () => state.now),
  };
}
test('majority commit, exact owned proof and fresh publication precede five-field disclosure', async () => {
  const f = fixture(),
    result = await f.repo.submit(user, input);
  assert.deepEqual(f.state.events, [
    'ready',
    'snapshot',
    'insert',
    'commit',
    'proof',
    'fresh',
    'closed',
  ]);
  assert.deepEqual(f.state.options.readConcern, { level: 'snapshot' });
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.equal(f.state.options.timeoutMS, 8000);
  assert.equal(f.state.options.maxCommitTimeMS, 2000);
  assert.equal(f.state.options.readPreference, 'primary');
  assert.equal(result.data.answer, 'PRIVATE');
  assert.deepEqual(
    Object.keys(result.data).sort(),
    ['id', 'conceptId', 'type', 'answer', 'explanation'].sort(),
  );
  assert.deepEqual(
    Object.keys(result.attempt).sort(),
    ['id', 'attemptNumber', 'result', 'submittedAt'].sort(),
  );
  assert.equal(f.state.rows[0]!.studentAnswer, input.studentAnswer);
  assert.equal(f.state.rows[0]!.score, null);
  assert(!JSON.stringify(result).includes('studentAnswer'));
});
test('installed driver inherits the transaction deadline without operation overrides or connections', async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27018', {
    serverSelectionTimeoutMS: 100,
  });
  const session = client.startSession(),
    stop = new Error('stop before executing any database operation'),
    collection = client.db('deeplearner-f021-test').collection('concepts');
  try {
    await assert.rejects(
      session.withTransaction(
        async () => {
          assert.throws(
            () => collection.aggregate([], { session, timeoutMS: 100 }),
            MongoInvalidArgumentError,
          );
          const aggregate = collection.aggregate([], { session }),
            find = collection.find({}, { session });
          await aggregate.close();
          await find.close();
          throw stop;
        },
        { timeoutMS: 200 },
      ),
      (error) => error === stop,
    );
    assert.equal(Reflect.get(client, 'topology'), undefined);
    // The transaction deadline is cleared afterwards; proof reads can set their own.
    const proof = collection.find({}, { session, timeoutMS: 100 });
    await proof.close();
    assert.equal(Reflect.get(client, 'topology'), undefined);
  } finally {
    await session.endSession();
    await client.close();
  }
});
test('same key replays exactly once; changed payload conflicts; keys are account-scoped', async () => {
  const f = fixture(),
    first = await f.repo.submit(user, input),
    replay = await f.repo.submit(user, input);
  assert.deepEqual(first.attempt, replay.attempt);
  assert.equal(f.state.rows.length, 1);
  for (const patch of [
    { studentAnswer: 'different' },
    { conceptId: 'f'.repeat(24) },
    { questionId: 'f'.repeat(24) },
    { questionRevision: 'f'.repeat(64) },
  ])
    await assert.rejects(f.repo.submit(user, { ...input, ...patch }), {
      code: 'PRACTICE_IDEMPOTENCY_CONFLICT',
    });
  await f.repo.submit('f'.repeat(24), input);
  assert.equal(f.state.rows.length, 2);
  assert.equal(f.state.rows[1]!.attemptNumber, 1);
});
test('different keys allocate immutable sequential attempts; input errors precede persistence', async () => {
  const f = fixture();
  await f.repo.submit(user, input);
  await f.repo.submit(user, {
    ...input,
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
  });
  assert.deepEqual(
    f.state.rows.map((row) => row.attemptNumber),
    [1, 2],
  );
  await assert.rejects(f.repo.submit(user, { ...input, studentAnswer: ' ' }), {
    code: 'VALIDATION_ERROR',
  });
  assert.equal(f.state.rows.length, 2);
});
test('missing or forged majority proof never reveals, even after successful commit', async () => {
  for (const field of [
    'userId',
    'questionId',
    'conceptId',
    'requestFingerprint',
    'contentFingerprint',
    'studentAnswer',
    'attemptNumber',
    'result',
    'score',
  ] as const) {
    const f = fixture(),
      proof = f.store.proof;
    f.store.proof = async (...args) => ({
      ...((await proof(...args)) as AttemptRecord),
      [field]: field.endsWith('Id')
        ? new Types.ObjectId()
        : field === 'attemptNumber' || field === 'score'
          ? 99
          : 'forged',
    });
    await assert.rejects(f.repo.submit(user, input), {
      code: 'PRACTICE_COMMIT_UNCONFIRMED',
    });
    assert(f.state.events.includes('closed'));
  }
  const f = fixture();
  f.state.proofFault = true;
  await assert.rejects(f.repo.submit(user, input), {
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
});
test('unknown commit never discloses; a later same-key request can resolve the durable row', async () => {
  const f = fixture();
  f.state.unknownCommit = true;
  await assert.rejects(f.repo.submit(user, input), {
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
  assert.equal(f.state.rows.length, 1);
  assert(!f.state.events.includes('proof'));
  f.state.unknownCommit = false;
  await f.repo.submit(user, input);
  assert.equal(f.state.rows.length, 1);
});
test('revision, solution and publication changes refuse replay or postcommit disclosure', async () => {
  for (const mode of ['revision', 'private', 'hidden']) {
    const f = fixture();
    await f.repo.submit(user, input);
    f.state.content =
      mode === 'hidden'
        ? null
        : {
            ...f.state.content!,
            [mode === 'private' ? 'contentFingerprint' : 'questionRevision']:
              'f'.repeat(64),
          };
    await assert.rejects(f.repo.submit(user, input), {
      code:
        mode === 'hidden' ? 'CONCEPT_NOT_FOUND' : 'PRACTICE_QUESTION_CHANGED',
    });
    assert.equal(f.state.rows.length, 1);
  }
  const f = fixture(),
    proof = f.store.proof;
  f.store.proof = async (...args) => {
    const row = await proof(...args);
    f.state.content = null;
    return row;
  };
  await assert.rejects(f.repo.submit(user, input), {
    code: 'CONCEPT_NOT_FOUND',
  });
  assert.equal(f.state.rows.length, 1);
});
test('known sequence collisions are bounded; unknown indexes and failed cleanup stay closed', async () => {
  const f = fixture();
  f.state.duplicate = 10;
  await assert.rejects(f.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(f.state.events.filter((event) => event === 'insert').length, 3);
  const g = fixture();
  g.store.insert = async () => {
    throw { code: 11000, keyPattern: { other: 1 } };
  };
  await assert.rejects(g.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  const h = fixture();
  h.state.cleanupFault = true;
  await assert.rejects(h.repo.submit(user, input), {
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
});
test('driver callback reentry and exhausted cleanup reserve cannot bypass limits', async () => {
  const f = fixture();
  f.state.bodyRuns = 4;
  await assert.rejects(f.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(f.state.events.filter((event) => event === 'insert').length, 3);
  assert.equal(f.state.rows.length, 0);
  const g = fixture();
  g.store.ready = async () => {
    g.state.now = 8001;
  };
  await assert.rejects(g.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert(!g.state.events.includes('snapshot'));
  assert(g.state.events.includes('closed'));
});
test('readiness requires all exact unique/full indexes and never provisions them', async () => {
  const indexes = attemptIndexes.map((index) => ({ ...index }));
  verifyAttemptIndexes(indexes);
  for (const patch of [
    { unique: false },
    { sparse: true },
    { partialFilterExpression: {} },
    { hidden: true },
    { expireAfterSeconds: 0 },
    { collation: { locale: 'en' } },
    { key: { questionId: 1, userId: 1, attemptNumber: 1 } },
  ])
    assert.throws(() =>
      verifyAttemptIndexes([{ ...indexes[0], ...patch }, ...indexes.slice(1)]),
    );
  assert.throws(() => verifyAttemptIndexes(indexes.slice(1)));
  const f = fixture();
  f.store.ready = async () => {
    throw Error('No indexes');
  };
  await assert.rejects(f.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(f.state.rows.length, 0);
  assert(!f.state.events.includes('snapshot'));
});
test('concurrent same-key requests converge; distinct keys use deterministic unique sequences', async () => {
  const f = fixture(),
    pending = new Map<ClientSession, AttemptRecord[]>(),
    stores = new Map<ClientSession, AttemptStore>();
  f.store.session = async () => {
    // Each store retains its own exact expected session; persisted rows are shared.
    const child = fixture();
    child.state.rows = f.state.rows;
    const session = await child.store.session();
    session.withTransaction = async (fn) => {
      pending.set(session, []);
      try {
        const result = await fn(session);
        f.state.rows.push(...pending.get(session)!);
        return result;
      } finally {
        pending.delete(session);
      }
    };
    stores.set(session, child.store);
    return session;
  };
  f.store.byKey = (...args) => stores.get(args[2])!.byKey(...args);
  f.store.last = (...args) => stores.get(args[2])!.last(...args);
  f.store.proof = (...args) => stores.get(args[3])!.proof(...args);
  f.store.qualified = async () => f.state.content;
  f.store.insert = async (row, session) => {
    const active = [...f.state.rows, ...Array.from(pending.values()).flat()];
    if (
      active.some(
        (x) =>
          x.userId.equals(row.userId) &&
          x.idempotencyKeyHash === row.idempotencyKeyHash,
      )
    )
      throw { code: 11000, keyPattern: attemptIndexes[1].key };
    if (
      active.some(
        (x) =>
          x.userId.equals(row.userId) &&
          x.questionId.equals(row.questionId) &&
          x.attemptNumber === row.attemptNumber,
      )
    )
      throw { code: 11000, keyPattern: attemptIndexes[0].key };
    pending.get(session)!.push(row);
  };
  const [a, b] = await Promise.all([
    f.repo.submit(user, input),
    f.repo.submit(user, input),
  ]);
  assert.equal(a.attempt.id, b.attempt.id);
  assert.equal(f.state.rows.length, 1);
  const results = await Promise.all(
    [
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ].map((key) => f.repo.submit(user, { ...input, idempotencyKey: key })),
  );
  assert.deepEqual(results.map((x) => x.attempt.attemptNumber).sort(), [2, 3]);
  assert.equal(pending.size, 0);
});
