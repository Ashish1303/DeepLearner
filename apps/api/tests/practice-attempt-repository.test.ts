import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { MongoClient, MongoInvalidArgumentError } from 'mongodb';
import {
  ProgressWriteConflict,
  type ProgressBaseline,
} from '../src/modules/progress/progress.repository.js';
import type { ProgressRecord } from '../src/modules/progress/progress.model.js';
import {
  createPracticeAttemptRepository,
  createPracticeAttemptCoordination,
  practiceAttemptCoordination,
  verifyAttemptIndexes,
  type AttemptStore,
  type PracticeAttemptCoordination,
} from '../src/modules/practice/practice-attempt.repository.js';
import {
  attemptIndexes,
  type AttemptRecord,
} from '../src/modules/practice/practice-attempt.model.js';
import type { QualifiedPractice } from '../src/modules/practice/practice.dto.js';
import { AppError } from '../src/common/errors/app-error.js';
import type { CompletionGrading } from '../src/modules/practice/completion-grading.service.js';
import { gradingOptions } from '../src/modules/practice/practice-rubric.repository.js';
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
function fixture(coordination: PracticeAttemptCoordination | null = null) {
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
    summary: null as ProgressRecord | null,
    pendingSummary: null as ProgressRecord | null,
    summaryFault: false,
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
          state.pendingSummary = null;
          await fn();
        }
        state.rows.push(...state.pending);
        if (state.pendingSummary) state.summary = state.pendingSummary;
        state.pending = [];
        state.events.push('commit');
        if (state.unknownCommit)
          throw { errorLabels: ['UnknownTransactionCommitResult'] };
      } catch (error) {
        state.pending = [];
        state.pendingSummary = null;
        throw error;
      }
    },
    async endSession() {
      state.events.push('closed');
      if (state.cleanupFault) throw Error('private');
    },
  } as unknown as ClientSession;
  const store: AttemptStore = {
    async progressBefore(owner, id, actual) {
      assert.equal(actual, session);
      state.events.push('progress-before');
      const times = state.rows.map((row) => row.submittedAt.getTime());
      return {
        userId: owner,
        hierarchy: {
          conceptId: id,
          technologyId: new Types.ObjectId(),
          learningPathId: new Types.ObjectId(),
          moduleId: new Types.ObjectId(),
          topicId: new Types.ObjectId(),
        },
        stats: {
          attemptCount: times.length,
          startedAt: times.length ? new Date(Math.min(...times)) : null,
          lastActivityAt: times.length ? new Date(Math.max(...times)) : null,
        },
        summary: state.summary,
        session: actual,
      };
    },
    async progressAfter(baseline, row, actual) {
      assert.equal(actual, session);
      assert.equal(baseline.session, actual);
      state.events.push('summary');
      if (state.summaryFault) throw Error('summary failure');
      const times = [...state.rows, ...state.pending].map((item) =>
        item.submittedAt.getTime(),
      );
      const now = new Date();
      state.pendingSummary = {
        ...baseline.hierarchy,
        _id: state.summary?._id ?? new Types.ObjectId(),
        userId: row.userId,
        attemptCount: times.length,
        status: 'IN_PROGRESS',
        startedAt: new Date(Math.min(...times)),
        lastActivityAt: new Date(Math.max(...times)),
        createdAt: state.summary?.createdAt ?? now,
        updatedAt: now,
        schemaVersion: 1,
      };
    },
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
    repo: createPracticeAttemptRepository(
      store,
      () => state.now,
      null,
      coordination,
    ),
  };
}
test('majority commit, exact owned proof and fresh publication precede five-field disclosure', async () => {
  const f = fixture(),
    result = await f.repo.submit(user, input);
  assert.deepEqual(f.state.events, [
    'ready',
    'snapshot',
    'progress-before',
    'insert',
    'summary',
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
    progressPending = new Map<ClientSession, ProgressRecord>(),
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
        if (progressPending.has(session))
          f.state.summary = progressPending.get(session)!;
        return result;
      } finally {
        pending.delete(session);
        progressPending.delete(session);
      }
    };
    stores.set(session, child.store);
    return session;
  };
  f.store.byKey = (...args) => stores.get(args[2])!.byKey(...args);
  f.store.last = (...args) => stores.get(args[2])!.last(...args);
  f.store.proof = (...args) => stores.get(args[3])!.proof(...args);
  f.store.progressBefore = (...args) =>
    stores.get(args[2])!.progressBefore(...args);
  f.store.progressAfter = async (baseline: ProgressBaseline, row, session) => {
    assert.equal(session, baseline.session);
    if ([...progressPending.keys()].some((other) => other !== session))
      throw new ProgressWriteConflict();
    const times = [...f.state.rows, ...pending.get(session)!].map((item) =>
        item.submittedAt.getTime(),
      ),
      now = new Date();
    progressPending.set(session, {
      ...baseline.hierarchy,
      _id: f.state.summary?._id ?? new Types.ObjectId(),
      userId: row.userId,
      attemptCount: times.length,
      status: 'IN_PROGRESS',
      startedAt: new Date(Math.min(...times)),
      lastActivityAt: new Date(Math.max(...times)),
      createdAt: f.state.summary?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: 1,
    });
  };
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
  assert.equal(progressPending.size, 0);
  assert.equal(f.state.summary?.attemptCount, 3);
});

test('missing progress readiness and summary failure cannot partially commit or reveal; replay never updates summary', async () => {
  const missing = fixture();
  missing.store.ready = async () => {
    throw Error('missing summary unique index');
  };
  await assert.rejects(missing.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(missing.state.rows.length, 0);
  assert.equal(missing.state.summary, null);
  const failed = fixture();
  failed.state.summaryFault = true;
  await assert.rejects(failed.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(failed.state.rows.length, 0);
  assert.equal(failed.state.summary, null);
  assert(!failed.state.events.includes('proof'));
  const ok = fixture();
  await ok.repo.submit(user, input);
  const snapshot = JSON.stringify(ok.state.summary);
  await ok.repo.submit(user, input);
  assert.equal(JSON.stringify(ok.state.summary), snapshot);
  assert.equal(
    ok.state.events.filter((event) => event === 'summary').length,
    1,
  );
});

function coordinationFixture() {
  const state = { local: true, client: {}, database: {}, live: true };
  const listeners = new Set<() => void>();
  const timers: { run(): void; ms: number; active: boolean }[] = [];
  const gate = createPracticeAttemptCoordination(
    {
      local: () => state.local,
      generation: () => state,
      onLoss(invalidate) {
        listeners.add(invalidate);
        return () => {
          listeners.delete(invalidate);
        };
      },
    },
    (run, ms) => {
      const timer = { run, ms, active: true };
      timers.push(timer);
      return () => {
        timer.active = false;
      };
    },
  );
  return {
    gate,
    state,
    listeners,
    timers,
    lose() {
      for (const listener of [...listeners]) listener();
    },
    fire(index: number) {
      const timer = timers[index]!;
      if (timer.active) {
        timer.active = false;
        timer.run();
      }
    },
  };
}
const gateKey = '1'.repeat(64),
  gateFingerprint = '2'.repeat(64),
  fullBudget = () => 10_000;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function until(check: () => boolean) {
  for (let i = 0; i < 40 && !check(); i++) await Promise.resolve();
  assert(
    check(),
    'bounded microtask observation did not reach the expected stage',
  );
}
function pausedProof(coordination: PracticeAttemptCoordination) {
  const f = fixture(coordination),
    reached = deferred(),
    resume = deferred(),
    original = f.store.proof;
  let reads = 0;
  f.store.proof = async (...args) => {
    if (++reads === 1) {
      reached.resolve();
      await resume.promise;
    }
    return original(...args);
  };
  return { ...f, reached, resume, reads: () => reads };
}

test('LOCAL same-key permits are FIFO, serialize replays and contain no cached result', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  assert.equal(leader.replayOnly, false);
  const order: number[] = [];
  const first = f.gate
    .enter(user, gateKey, gateFingerprint, fullBudget)
    .then((p) => {
      order.push(1);
      return p!;
    });
  const second = f.gate
    .enter(user, gateKey, gateFingerprint, fullBudget)
    .then((p) => {
      order.push(2);
      return p!;
    });
  assert.deepEqual(order, []);
  leader.finish(true);
  const a = await first;
  assert.deepEqual(order, [1]);
  assert.equal(a.replayOnly, true);
  assert.throws(() => leader.assert(), { code: 'DEPENDENCY_UNAVAILABLE' });
  a.finish(true);
  const b = await second;
  assert.deepEqual(order, [1, 2]);
  assert.equal(b.replayOnly, true);
  assert.deepEqual(Object.keys(b).sort(), ['assert', 'finish', 'replayOnly']);
  assert.equal(JSON.stringify(b), '{"replayOnly":true}');
  b.finish(true);
  assert.equal(f.listeners.size, 0);
  assert(f.timers.every((timer) => !timer.active));
});

test('same account/key changed fingerprint conflicts while other accounts and keys are isolated', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  await assert.rejects(
    f.gate.enter(user, gateKey, '3'.repeat(64), fullBudget),
    { code: 'PRACTICE_IDEMPOTENCY_CONFLICT', statusCode: 409 },
  );
  const otherAccount = await f.gate.enter(
      'f'.repeat(24),
      gateKey,
      gateFingerprint,
      fullBudget,
    ),
    otherKey = await f.gate.enter(
      user,
      '4'.repeat(64),
      gateFingerprint,
      fullBudget,
    );
  assert(otherAccount && otherKey);
  assert.equal(otherAccount.replayOnly, false);
  assert.equal(otherKey.replayOnly, false);
  assert.equal(f.timers.length, 0);
  leader.finish(true);
  otherAccount.finish(true);
  otherKey.finish(true);
  assert.equal(f.listeners.size, 0);
});

test('coordination enforces 100 active keys across generations and releases capacity', async () => {
  const f = coordinationFixture();
  const leaders = [];
  for (let i = 0; i < 100; i++)
    leaders.push(
      (await f.gate.enter(
        user,
        i.toString(16).padStart(64, '0'),
        gateFingerprint,
        fullBudget,
      ))!,
    );
  await assert.rejects(
    f.gate.enter(user, 'f'.repeat(64), gateFingerprint, fullBudget),
    { code: 'DEPENDENCY_UNAVAILABLE', statusCode: 503 },
  );
  f.lose();
  f.state.client = {};
  f.state.database = {};
  await assert.rejects(
    f.gate.enter(user, 'f'.repeat(64), gateFingerprint, fullBudget),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  leaders.shift()!.finish(false);
  const next = await f.gate.enter(
    user,
    'f'.repeat(64),
    gateFingerprint,
    fullBudget,
  );
  assert(next);
  for (const leader of leaders) leader.finish(false);
  next.finish(true);
  assert.equal(f.listeners.size, 0);
});

test('coordination admits at most ten queued followers and rejects overflow deterministically', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  const failures = Array.from({ length: 10 }, () =>
    assert.rejects(f.gate.enter(user, gateKey, gateFingerprint, fullBudget), {
      code: 'PRACTICE_COMMIT_UNCONFIRMED',
    }),
  );
  await assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, fullBudget),
    {
      code: 'DEPENDENCY_UNAVAILABLE',
    },
  );
  assert.equal(f.timers.length, 10);
  leader.finish(false);
  await Promise.all(failures);
  assert(f.timers.every((timer) => !timer.active));
  assert.equal(f.listeners.size, 0);
});

test('deadline detaches only its follower and stale admission cannot spend the proof reserve', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  let remaining = 2300;
  const timedOut = assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, () => remaining),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  assert.equal(f.timers[0]!.ms, 300);
  remaining = 2000;
  f.fire(0);
  await timedOut;
  leader.assert();
  const expired = assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, () => remaining + 1),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
  const valid = f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  remaining = 1999;
  leader.finish(true);
  await expired;
  const follower = await valid;
  assert(follower?.replayOnly);
  follower.finish(true);
  assert.equal(f.listeners.size, 0);
});

test('nonlocal, malformed, unavailable or unverifiable coordination contexts cannot grant a permit', async () => {
  const f = coordinationFixture();
  f.state.local = false;
  assert.equal(
    await f.gate.enter(user, gateKey, gateFingerprint, fullBudget),
    null,
  );
  assert.equal(f.listeners.size, 0);
  f.state.local = true;
  for (const remaining of [
    0,
    2000,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    10_001,
  ])
    await assert.rejects(
      f.gate.enter(user, gateKey, gateFingerprint, () => remaining),
      {
        code: 'DEPENDENCY_UNAVAILABLE',
      },
    );
  await assert.rejects(
    f.gate.enter(user + '\n', gateKey, gateFingerprint, fullBudget),
    {
      code: 'DEPENDENCY_UNAVAILABLE',
    },
  );
  f.state.live = false;
  await assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, fullBudget),
    {
      code: 'DEPENDENCY_UNAVAILABLE',
    },
  );
  const unavailable = createPracticeAttemptCoordination({
    local: () => true,
    generation() {
      throw Error('private context');
    },
    onLoss() {
      throw Error('must not subscribe');
    },
  });
  await assert.rejects(
    unavailable.enter(user, gateKey, gateFingerprint, fullBudget),
    {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Practice submission unavailable',
    },
  );
  assert.equal(f.listeners.size, 0);
});

test('runtime coordination honors the existing LOCAL default and never opens a database connection', async () => {
  if ((process.env.APP_ENV ?? 'LOCAL') === 'LOCAL')
    await assert.rejects(
      practiceAttemptCoordination.enter(
        user,
        gateKey,
        gateFingerprint,
        fullBudget,
      ),
      { code: 'DEPENDENCY_UNAVAILABLE' },
    );
  else
    assert.equal(
      await practiceAttemptCoordination.enter(
        user,
        gateKey,
        gateFingerprint,
        fullBudget,
      ),
      null,
    );
});

test('generation loss rejects old waiters and permits permanently without leaking into a new generation', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  const failed = assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, fullBudget),
    {
      code: 'PRACTICE_COMMIT_UNCONFIRMED',
    },
  );
  f.lose();
  await failed;
  assert.throws(() => leader.assert(), { code: 'DEPENDENCY_UNAVAILABLE' });
  // Even if the driver retains client/Db object identities, the old domain is terminal.
  const next = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(next && !next.replayOnly);
  leader.finish(true);
  next.assert();
  next.finish(true);
  assert.equal(f.listeners.size, 0);
});

test('changed actual database identity refuses stale permits even without a delivered loss event', async () => {
  const f = coordinationFixture(),
    leader = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(leader);
  const failed = assert.rejects(
    f.gate.enter(user, gateKey, gateFingerprint, fullBudget),
    {
      code: 'PRACTICE_COMMIT_UNCONFIRMED',
    },
  );
  f.state.database = {};
  assert.throws(() => leader.assert(), { code: 'DEPENDENCY_UNAVAILABLE' });
  await failed;
  const next = await f.gate.enter(user, gateKey, gateFingerprint, fullBudget);
  assert(next);
  leader.finish(false);
  next.finish(true);
  assert.equal(f.listeners.size, 0);
});

test('coordinated identical submissions each verify owned proof and never reuse the leader result', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    first = f.repo.submit(user, input);
  await f.reached.promise;
  const second = f.repo.submit(user, input);
  await until(() => coordination.timers.length === 1);
  f.resume.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  assert.equal(f.reads(), 2);
  assert.equal(f.state.rows.length, 1);
  assert.equal(f.state.events.filter((event) => event === 'summary').length, 1);
  assert.equal(f.state.events.filter((event) => event === 'fresh').length, 2);
  assert.equal(f.state.events.filter((event) => event === 'closed').length, 2);
  assert.equal(coordination.listeners.size, 0);
});

test('queued requests retain their original elapsed budget when beginning the replay transaction', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    first = f.repo.submit(user, input);
  await f.reached.promise;
  let followerNow = 0;
  const followerRepo = createPracticeAttemptRepository(
    f.store,
    () => followerNow,
    null,
    coordination.gate,
  );
  const second = followerRepo.submit(user, input);
  await until(() => coordination.timers.length === 1);
  followerNow = 6000;
  f.resume.resolve();
  await Promise.all([first, second]);
  assert.equal(f.state.options.timeoutMS, 2000);
  assert.equal(f.state.options.maxCommitTimeMS, 2000);
  assert.equal(f.state.rows.length, 1);
});

test('timed-out repository follower detaches without cancelling its leader or starting a session', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    first = f.repo.submit(user, input);
  await f.reached.promise;
  let followerNow = 0;
  const repo = createPracticeAttemptRepository(
    f.store,
    () => followerNow,
    null,
    coordination.gate,
  );
  const rejected = assert.rejects(repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  await until(() => coordination.timers.length === 1);
  followerNow = 8000;
  coordination.fire(0);
  await rejected;
  assert.equal(f.reads(), 1);
  f.resume.resolve();
  await first;
  assert.equal(f.state.rows.length, 1);
  assert.equal(f.state.events.filter((event) => event === 'closed').length, 1);
});

test('leader failure, uncertain commit and cleanup failure reject all queued followers without takeover', async () => {
  for (const fault of ['insert', 'unknown', 'cleanup'] as const) {
    const coordination = coordinationFixture(),
      f = fixture(coordination.gate),
      reached = deferred(),
      resume = deferred(),
      insert = f.store.insert;
    f.store.insert = async (...args) => {
      reached.resolve();
      await resume.promise;
      if (fault === 'insert') throw Error('private transaction failure');
      return insert(...args);
    };
    f.state.unknownCommit = fault === 'unknown';
    f.state.cleanupFault = fault === 'cleanup';
    const first = assert.rejects(f.repo.submit(user, input), {
      code:
        fault === 'insert'
          ? 'DEPENDENCY_UNAVAILABLE'
          : 'PRACTICE_COMMIT_UNCONFIRMED',
    });
    await reached.promise;
    const second = assert.rejects(f.repo.submit(user, input), {
      code: 'PRACTICE_COMMIT_UNCONFIRMED',
    });
    await until(() => coordination.timers.length === 1);
    resume.resolve();
    await Promise.all([first, second]);
    assert.equal(
      f.state.events.filter((event) => event === 'insert').length,
      fault === 'insert' ? 0 : 1,
    );
    assert.equal(
      f.state.events.filter((event) => event === 'closed').length,
      1,
    );
    assert.equal(coordination.listeners.size, 0);
    assert(coordination.timers.every((timer) => !timer.active));
  }
});

test('followers recheck publication, revisions and solution binding and never replace a missing original', async () => {
  for (const fault of [
    'publication',
    'revision',
    'solution',
    'missing',
  ] as const) {
    const coordination = coordinationFixture(),
      f = pausedProof(coordination.gate),
      ready = f.store.ready;
    let readiness = 0;
    f.store.ready = async (...args) => {
      await ready(...args);
      if (++readiness === 3) {
        if (fault === 'publication') f.state.content = null;
        else if (fault === 'revision')
          f.state.content!.questionRevision = 'f'.repeat(64);
        else if (fault === 'solution')
          f.state.content!.contentFingerprint = 'f'.repeat(64);
        else f.state.rows.length = 0;
      }
    };
    const first = f.repo.submit(user, input);
    await f.reached.promise;
    const second = assert.rejects(f.repo.submit(user, input), {
      code:
        fault === 'publication'
          ? 'CONCEPT_NOT_FOUND'
          : fault === 'missing'
            ? 'PRACTICE_COMMIT_UNCONFIRMED'
            : 'PRACTICE_QUESTION_CHANGED',
    });
    await until(() => coordination.timers.length === 1);
    f.resume.resolve();
    await Promise.all([first, second]);
    assert.equal(
      f.state.events.filter((event) => event === 'insert').length,
      1,
    );
    assert.equal(f.reads(), 1);
  }
});

test('coordinated followers independently invoke qualifying authority and assessment proof, including refusal', async () => {
  for (const fault of ['none', 'authority', 'proof'] as const) {
    const coordination = coordinationFixture(),
      f = pausedProof(coordination.gate),
      replays: boolean[] = [];
    let proofs = 0;
    const repo = createPracticeAttemptRepository(
      f.store,
      () => f.state.now,
      {
        async before() {},
        async record(_attempt, replay) {
          replays.push(replay);
          if (replay && fault === 'authority')
            throw new AppError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Authority unavailable',
            );
          return undefined;
        },
        async proof() {
          if (++proofs === 2 && fault === 'proof')
            throw new AppError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Proof unavailable',
            );
        },
      },
      coordination.gate,
    );
    const first = repo.submit(user, input);
    await f.reached.promise;
    const following = repo.submit(user, input);
    const second =
      fault === 'none'
        ? following
        : assert.rejects(following, { code: 'DEPENDENCY_UNAVAILABLE' });
    await until(() => coordination.timers.length === 1);
    f.resume.resolve();
    await Promise.all([first, second]);
    assert.deepEqual(replays, [false, true]);
    assert.equal(proofs, fault === 'authority' ? 1 : 2);
    assert.equal(f.state.rows.length, 1);
    assert.equal(
      f.state.events.filter((event) => event === 'summary').length,
      1,
    );
    assert.equal(coordination.listeners.size, 0);
  }
});

test('followers perform their own majority ownership proof and fail closed on mismatched proof', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    proof = f.store.proof;
  let calls = 0;
  f.store.proof = async (...args) => (++calls === 2 ? null : proof(...args));
  const first = f.repo.submit(user, input);
  await f.reached.promise;
  const second = assert.rejects(f.repo.submit(user, input), {
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
  await until(() => coordination.timers.length === 1);
  f.resume.resolve();
  await Promise.all([first, second]);
  assert.equal(calls, 2);
  assert.equal(f.state.rows.length, 1);
});

test('followers revalidate current qualification authority after waiting and before replay', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate);
  let ready = 0;
  const repo = createPracticeAttemptRepository(
    f.store,
    () => f.state.now,
    {
      async before() {
        if (++ready === 3)
          throw new AppError(403, 'AUTH_FORBIDDEN', 'Current Student required');
      },
      async record() {
        return undefined;
      },
      async proof() {},
    },
    coordination.gate,
  );
  const first = repo.submit(user, input);
  await f.reached.promise;
  const second = assert.rejects(repo.submit(user, input), {
    code: 'AUTH_FORBIDDEN',
  });
  await until(() => coordination.timers.length === 1);
  f.resume.resolve();
  await Promise.all([first, second]);
  assert.equal(ready, 3);
  assert.equal(f.reads(), 1);
});

test('loss during an active proof prevents leader disclosure and rejects its queued follower', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    first = assert.rejects(f.repo.submit(user, input), {
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  await f.reached.promise;
  const second = assert.rejects(f.repo.submit(user, input), {
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
  await until(() => coordination.timers.length === 1);
  coordination.lose();
  await second;
  f.resume.resolve();
  await first;
  assert.equal(f.state.rows.length, 1);
  assert.equal(coordination.listeners.size, 0);
});

test('coordination does not reset or bypass the existing three-work-body guard', async () => {
  const coordination = coordinationFixture(),
    f = fixture(coordination.gate);
  f.state.bodyRuns = 4;
  await assert.rejects(f.repo.submit(user, input), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(f.state.events.filter((event) => event === 'insert').length, 3);
  assert.equal(f.state.rows.length, 0);
  assert.equal(coordination.listeners.size, 0);
});

function proofRepository(
  f: ReturnType<typeof fixture>,
  proof: CompletionGrading['proof'],
  coordination: PracticeAttemptCoordination | null = null,
) {
  return createPracticeAttemptRepository(
    f.store,
    () => f.state.now,
    {
      async before() {},
      async record() {
        return undefined;
      },
      proof,
    },
    coordination,
  );
}

test('qualifying majority proof recomputes each operation timeout within the original request budget', async () => {
  const f = fixture(),
    observed: number[] = [];
  const repo = proofRepository(f, async (attempt, read) => {
    assert.equal(attempt._id.toHexString(), f.state.rows[0]!._id.toHexString());
    assert.equal(read.session, await f.store.session());
    assert.equal(read.majority, true);
    // Exercise the real database-options adapter between separate proof reads.
    for (const elapsed of [1000, 3000, 7000]) {
      f.state.now = elapsed;
      const options = gradingOptions(read);
      assert.equal(options.readConcern?.level, 'majority');
      assert.equal(options.readPreference, 'primary');
      observed.push(options.timeoutMS!);
    }
    f.state.now = 9999;
  });
  const result = await repo.submit(user, input);
  assert.deepEqual(observed, [9000, 7000, 3000]);
  assert.equal(result.data.answer, 'PRIVATE');
  assert.equal(f.state.rows.length, 1);
  assert.equal(f.state.options.timeoutMS, 8000);
  assert.equal(f.state.options.maxCommitTimeMS, 2000);
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.equal(
    f.state.events.filter((event) => event === 'snapshot').length,
    1,
  );
});

test('exhaustion before the first postcommit proof read suppresses disclosure without undoing a durable attempt', async () => {
  const f = fixture(),
    recordProgress = f.store.progressAfter;
  f.store.progressAfter = async (...args) => {
    await recordProgress(...args);
    f.state.now = 10000;
  };
  let assessmentProofs = 0;
  const repo = proofRepository(f, async () => {
    assessmentProofs++;
  });
  await assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(f.state.rows.length, 1);
  assert.equal(assessmentProofs, 0);
  assert(!f.state.events.includes('proof'));
  assert(f.state.events.includes('closed'));
});

test('exhaustion before qualifying-assessment proof prevents its first database operation', async () => {
  const f = fixture(),
    qualified = f.store.qualified;
  f.store.qualified = async (...args) => {
    const value = await qualified(...args);
    if (args[4]) f.state.now = 10000;
    return value;
  };
  let proofCalls = 0;
  const repo = proofRepository(f, async (_attempt, read) => {
    proofCalls++;
    gradingOptions(read);
  });
  await assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.equal(proofCalls, 0);
  assert.equal(f.state.rows.length, 1);
  assert(f.state.events.includes('proof'));
  assert(f.state.events.includes('closed'));
});

test('exhaustion between qualifying proof reads refuses the next operation rather than renewing its allowance', async () => {
  const f = fixture(),
    completedReads: number[] = [];
  const repo = proofRepository(f, async (_attempt, read) => {
    f.state.now = 9000;
    completedReads.push(gradingOptions(read).timeoutMS!);
    f.state.now = 10000;
    completedReads.push(gradingOptions(read).timeoutMS!);
  });
  await assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert.deepEqual(completedReads, [1000]);
  assert.equal(f.state.rows.length, 1);
  assert.equal(f.state.events.filter((event) => event === 'insert').length, 1);
});

test('successful owned proof cannot authorize disclosure when its completion exhausts the deadline', async () => {
  for (const expired of [10000, 10001]) {
    const f = fixture();
    let completed = false;
    const repo = proofRepository(f, async (_attempt, read) => {
      assert.equal(gradingOptions(read).readConcern?.level, 'majority');
      completed = true;
      f.state.now = expired;
    });
    await assert.rejects(repo.submit(user, input), (error: unknown) => {
      assert(error instanceof AppError);
      assert.equal(error.statusCode, 503);
      assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
      assert(!JSON.stringify(error).includes('PRIVATE'));
      return true;
    });
    assert(completed);
    assert.equal(f.state.rows.length, 1);
    assert(f.state.events.includes('closed'));
  }
});

test('deadline spent closing a proven leader fails its queued identical follower closed', async () => {
  const coordination = coordinationFixture(),
    f = pausedProof(coordination.gate),
    session = await f.store.session(),
    end = session.endSession.bind(session);
  session.endSession = async () => {
    await end();
    f.state.now = 10000;
  };
  let proofCalls = 0;
  const repo = proofRepository(
    f,
    async () => {
      proofCalls++;
    },
    coordination.gate,
  );
  const first = assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  await f.reached.promise;
  const second = assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'PRACTICE_COMMIT_UNCONFIRMED',
  });
  await until(() => coordination.timers.length === 1);
  f.resume.resolve();
  await Promise.all([first, second]);
  assert.equal(proofCalls, 1);
  assert.equal(f.state.rows.length, 1);
  assert.equal(f.state.events.filter((event) => event === 'insert').length, 1);
  assert.equal(coordination.listeners.size, 0);
});

test('the final disclosure deadline also includes synchronous coordination cleanup', async () => {
  const f = fixture();
  let finished = false;
  const coordination: PracticeAttemptCoordination = {
    async enter() {
      return {
        replayOnly: false,
        assert() {},
        finish() {
          finished = true;
          f.state.now = 10000;
        },
      };
    },
  };
  const repo = proofRepository(f, async () => {}, coordination);
  await assert.rejects(repo.submit(user, input), {
    statusCode: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert(finished);
  assert.equal(f.state.rows.length, 1);
  assert(f.state.events.includes('closed'));
});
