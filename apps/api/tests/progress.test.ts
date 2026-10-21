import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import {
  createProgressRepository,
  verifyProgressIndexes,
  attemptStatsStages,
  type ProgressStore,
} from '../src/modules/progress/progress.repository.js';
import {
  progressIndex,
  type ProgressRecord,
  emptyCompletionFields,
} from '../src/modules/progress/progress.model.js';
import { progressRequest } from '../src/modules/progress/progress.schema.js';
import { progressDto } from '../src/modules/progress/progress.dto.js';
import { createProgressService } from '../src/modules/progress/progress.service.js';
import type { UserDto } from '../src/modules/users/user.dto.js';
import type { AttemptRecord } from '../src/modules/practice/practice-attempt.model.js';
const uid = 'a'.repeat(24),
  cid = 'b'.repeat(24),
  at = new Date('2026-10-19T00:00:00.000Z');
function fixture() {
  const hierarchy = {
    conceptId: new Types.ObjectId(cid),
    technologyId: new Types.ObjectId(),
    learningPathId: new Types.ObjectId(),
    moduleId: new Types.ObjectId(),
    topicId: new Types.ObjectId(),
  };
  const state = {
    stats: {
      attemptCount: 0,
      startedAt: null as Date | null,
      lastActivityAt: null as Date | null,
    },
    rows: [] as unknown[],
    writes: [] as ProgressRecord[],
    events: [] as string[],
    options: {} as Record<string, unknown>,
    index: [{ ...progressIndex, v: 2 }] as Record<string, unknown>[],
    readyFailure: false,
    cleanupFailure: false,
    hidden: false,
    updateFailure: false,
    now: 0,
  };
  const session = {
    async withTransaction(
      fn: () => Promise<void>,
      options: Record<string, unknown>,
    ) {
      state.options = options;
      state.events.push('snapshot');
      await fn();
    },
    async endSession() {
      state.events.push('close');
      if (state.cleanupFailure) throw Error('private');
    },
  } as unknown as ClientSession;
  const store: ProgressStore = {
    async ready(ms) {
      state.events.push('index');
      assert(ms > 0);
      if (state.readyFailure) throw Error('private');
      verifyProgressIndexes(state.index);
    },
    async session() {
      return session;
    },
    async hierarchy(id, s) {
      assert.equal(id.toHexString(), cid);
      assert.equal(s, session);
      return state.hidden ? null : hierarchy;
    },
    async stats(owner, id, s) {
      assert.equal(owner.toHexString(), uid);
      assert.equal(id.toHexString(), cid);
      assert.equal(s, session);
      return { ...state.stats };
    },
    async summaries(owner, id, s) {
      assert.equal(owner.toHexString(), uid);
      assert.equal(id.toHexString(), cid);
      assert.equal(s, session);
      return state.rows;
    },
    async insert(row, s) {
      assert.equal(s, session);
      state.writes.push(row);
      state.rows = [row];
    },
    async update(before, after, s) {
      assert.equal(s, session);
      assert.deepEqual(before, state.rows[0]);
      if (state.updateFailure) return false;
      state.writes.push(after);
      state.rows = [after];
      return true;
    },
  };
  return {
    state,
    store,
    session,
    hierarchy,
    repo: createProgressRepository(store, () => state.now),
  };
}
test('Slice 2 F037 reads v2 as the same five-field activity view without writes or leaking completion scores', async () => {
  const f = fixture();
  f.state.stats = { attemptCount: 1, startedAt: at, lastActivityAt: at };
  f.state.rows = [
    {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(uid),
      ...f.hierarchy,
      ...f.state.stats,
      status: 'IN_PROGRESS',
      schemaVersion: 2,
      createdAt: at,
      updatedAt: at,
      ...emptyCompletionFields(),
      firstScore: 100,
      latestScore: 100,
      bestScore: 100,
    },
  ];
  const view = await f.repo.read(uid, cid);
  assert.equal(Object.keys(view).length, 5);
  assert.equal(view.status, 'IN_PROGRESS');
  assert.equal('firstScore' in view, false);
  assert.equal(f.state.writes.length, 0);
});
test('Slice 2 new qualifying activity creates v2 atomically; replay-free ordinary updates preserve its extension', async () => {
  const f = fixture();
  f.state.stats = { attemptCount: 0, startedAt: null, lastActivityAt: null };
  const id = new Types.ObjectId(),
    a = {
      _id: id,
      userId: new Types.ObjectId(uid),
      conceptId: new Types.ObjectId(cid),
      submittedAt: at,
    } as AttemptRecord;
  f.store.qualifyingScores = async () => ({
    firstScore: 0,
    latestScore: 0,
    bestScore: 0,
    attemptIds: [id.toHexString()],
  });
  const baseline = await f.repo.prepare(a.userId, a.conceptId, f.session);
  f.state.stats = { attemptCount: 1, startedAt: at, lastActivityAt: at };
  await f.repo.record(baseline, a, f.session);
  const row = f.state.writes[0]!;
  assert.equal(row.schemaVersion, 2);
  if (row.schemaVersion !== 2) assert.fail();
  assert.equal(row.firstScore, 0);
  assert.equal(row.status, 'IN_PROGRESS');
  assert.equal(row.completion, null);
  const next = await f.repo.prepare(a.userId, a.conceptId, f.session),
    later = {
      ...a,
      _id: new Types.ObjectId(),
      submittedAt: new Date(at.getTime() + 1000),
    };
  f.state.stats = {
    attemptCount: 2,
    startedAt: at,
    lastActivityAt: later.submittedAt,
  };
  await f.repo.record(next, later, f.session);
  const updated = f.state.writes[1]!;
  assert.equal(updated.schemaVersion, 2);
  if (updated.schemaVersion !== 2) assert.fail();
  assert.equal(updated.firstScore, 0);
  assert.equal(updated.completion, null);
  assert.equal(updated.attemptCount, 2);
});
test('Slice 2 ordinary v1 activity does not invent a score or migrate unrelated summaries', async () => {
  const f = fixture(),
    a = {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(uid),
      conceptId: new Types.ObjectId(cid),
      submittedAt: at,
    } as AttemptRecord;
  f.store.qualifyingScores = async () => null;
  const baseline = await f.repo.prepare(a.userId, a.conceptId, f.session);
  f.state.stats = { attemptCount: 1, startedAt: at, lastActivityAt: at };
  await f.repo.record(baseline, a, f.session);
  assert.equal(f.state.writes[0]!.schemaVersion, 1);
  assert.equal('firstScore' in f.state.writes[0]!, false);
});
test('Slice 2 ordinary attempts preserve an existing completed decision while activity GET stays IN_PROGRESS', async () => {
  const f = fixture(),
    completion = {
      policyId: new Types.ObjectId(),
      policyVersion: 1,
      policyFingerprint: 'a'.repeat(64),
      conceptRevision: 'b'.repeat(64),
      sourceEpoch: 'c'.repeat(64),
      decisionVersion: 1,
      requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
      sectionReceipts: ['READ', 'VISUALIZE', 'EXAMPLE'].map((section) => ({
        section,
        receiptId: new Types.ObjectId(),
      })),
      assessmentId: new Types.ObjectId(),
      attemptId: new Types.ObjectId(),
      minimumScore: 70,
      selectedScore: 100,
      requestReceiptId: new Types.ObjectId(),
    };
  f.state.stats = { attemptCount: 1, startedAt: at, lastActivityAt: at };
  f.state.rows = [
    {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(uid),
      ...f.hierarchy,
      ...f.state.stats,
      createdAt: at,
      updatedAt: at,
      schemaVersion: 2,
      status: 'COMPLETED',
      completion,
      completedAt: at,
      sections: {
        readCompleted: true,
        visualizeCompleted: true,
        exampleCompleted: true,
        practiceCompleted: true,
        reviseCompleted: false,
      },
      firstScore: 100,
      latestScore: 100,
      bestScore: 100,
    },
  ];
  const before = await f.repo.prepare(
      new Types.ObjectId(uid),
      new Types.ObjectId(cid),
      f.session,
    ),
    later = new Date(at.getTime() + 1000);
  f.state.stats = { attemptCount: 2, startedAt: at, lastActivityAt: later };
  await f.repo.record(
    before,
    {
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(uid),
      conceptId: new Types.ObjectId(cid),
      submittedAt: later,
    } as AttemptRecord,
    f.session,
  );
  const row = f.state.writes[0]!;
  assert.equal(row.schemaVersion, 2);
  if (row.schemaVersion !== 2) assert.fail();
  assert.equal(row.status, 'COMPLETED');
  assert.deepEqual(row.completion, completion);
  assert.equal(row.completedAt!.getTime(), at.getTime());
  assert.equal(row.firstScore, 100);
  const publicView = await f.repo.read(uid, cid);
  assert.equal(publicView.status, 'IN_PROGRESS');
  assert.equal(publicView.attemptCount, 2);
  assert.equal(Object.keys(publicView).length, 5);
});
test('GET index refusal precedes snapshots/fallback for missing, stale, nonunique and unverifiable definitions', async () => {
  for (const mode of ['missing', 'nonunique', 'wrong', 'unknown']) {
    const f = fixture();
    if (mode === 'missing') f.state.index = [];
    if (mode === 'nonunique')
      f.state.index = [{ ...progressIndex, v: 2, unique: false }];
    if (mode === 'wrong')
      f.state.index = [
        { ...progressIndex, v: 2, key: { conceptId: 1, userId: 1 } },
      ];
    if (mode === 'unknown') f.state.readyFailure = true;
    await assert.rejects(f.repo.read(uid, cid), {
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    assert.deepEqual(f.state.events, ['index']);
    assert.equal(f.state.writes.length, 0);
  }
});
test('empty state and historical fallback use one read-only snapshot and exact five-field DTO', async () => {
  const f = fixture();
  const empty = await f.repo.read(uid, cid);
  assert.deepEqual(empty, {
    conceptId: cid,
    status: 'NOT_STARTED',
    attemptCount: 0,
    startedAt: null,
    lastActivityAt: null,
  });
  f.state.stats = {
    attemptCount: 4,
    startedAt: at,
    lastActivityAt: new Date(at.getTime() + 500),
  };
  const result = await f.repo.read(uid, cid);
  assert.equal(result.attemptCount, 4);
  assert.equal(result.startedAt, at.toISOString());
  assert.equal(f.state.writes.length, 0);
  assert.equal(f.state.rows.length, 0);
  assert.equal(f.state.options.timeoutMS, 5000);
  assert.deepEqual(f.state.options.readConcern, { level: 'snapshot' });
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.equal(f.state.options.readPreference, 'primary');
  assert(!JSON.stringify(result).includes('userId'));
  assert.equal(Object.keys(result).length, 5);
});
test('new summary includes historical attempts and updates only with exact session, count and times', async () => {
  const f = fixture();
  f.state.stats = { attemptCount: 3, startedAt: at, lastActivityAt: at };
  const before = await f.repo.prepare(
    new Types.ObjectId(uid),
    new Types.ObjectId(cid),
    f.session,
  );
  const submittedAt = new Date(at.getTime() + 1000);
  const attempt = {
    userId: new Types.ObjectId(uid),
    conceptId: new Types.ObjectId(cid),
    submittedAt,
  } as AttemptRecord;
  f.state.stats = {
    attemptCount: 4,
    startedAt: at,
    lastActivityAt: submittedAt,
  };
  await f.repo.record(before, attempt, f.session);
  assert.equal(f.state.writes.length, 1);
  assert.equal(f.state.writes[0]!.attemptCount, 4);
  assert.equal(f.state.writes[0]!.startedAt.getTime(), at.getTime());
  assert(!JSON.stringify(f.state.writes[0]).includes('studentAnswer'));
  const next = await f.repo.prepare(
    new Types.ObjectId(uid),
    new Types.ObjectId(cid),
    f.session,
  );
  const later = new Date(at.getTime() + 2000);
  f.state.stats = { attemptCount: 5, startedAt: at, lastActivityAt: later };
  await f.repo.record(next, { ...attempt, submittedAt: later }, f.session);
  assert.equal(f.state.writes[1]!._id, next.summary!._id);
  assert.equal(f.state.writes[1]!.createdAt, next.summary!.createdAt);
  await assert.rejects(f.repo.record(next, attempt, {} as ClientSession), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  await assert.rejects(
    f.repo.record(
      next,
      { ...attempt, userId: new Types.ObjectId() },
      f.session,
    ),
    { code: 'DEPENDENCY_UNAVAILABLE' },
  );
});
test('stale, duplicate, unknown-field and cross-owner/reference summaries fail closed without repair', async () => {
  const f = fixture();
  f.state.stats = { attemptCount: 1, startedAt: at, lastActivityAt: at };
  const baseline = await f.repo.prepare(
    new Types.ObjectId(uid),
    new Types.ObjectId(cid),
    f.session,
  );
  f.state.stats = { attemptCount: 2, startedAt: at, lastActivityAt: at };
  await f.repo.record(
    baseline,
    {
      userId: new Types.ObjectId(uid),
      conceptId: new Types.ObjectId(cid),
      submittedAt: at,
    } as AttemptRecord,
    f.session,
  );
  const original = f.state.rows[0] as ProgressRecord;
  for (const rows of [
    [{ ...original, attemptCount: 1 }],
    [original, original],
    [{ ...original, answer: 'SECRET' }],
    [{ ...original, userId: new Types.ObjectId() }],
    [{ ...original, topicId: new Types.ObjectId() }],
  ]) {
    f.state.rows = rows;
    await assert.rejects(f.repo.read(uid, cid), {
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  }
  assert.equal(f.state.writes.length, 1);
});
test('invalid count/date, unknown publication and cleanup failures never become zero/success', async () => {
  const f = fixture();
  f.state.hidden = true;
  await assert.rejects(f.repo.read(uid, cid), { code: 'CONCEPT_NOT_FOUND' });
  f.state.hidden = false;
  f.state.stats = { attemptCount: 1, startedAt: null, lastActivityAt: null };
  await assert.rejects(f.repo.read(uid, cid), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  f.state.stats = { attemptCount: 0, startedAt: null, lastActivityAt: null };
  f.state.cleanupFailure = true;
  await assert.rejects(f.repo.read(uid, cid), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  const g = fixture();
  g.store.ready = async () => {
    g.state.now = 5001;
  };
  await assert.rejects(g.repo.read(uid, cid), {
    code: 'DEPENDENCY_UNAVAILABLE',
  });
  assert(g.state.events.includes('close'));
});
test('strict query/body and DTO contracts preserve canonical IDs and reject accidental private/completion data', () => {
  assert.equal(
    progressRequest.parse({
      params: {},
      query: { conceptId: cid.toUpperCase() },
    }).query.conceptId,
    cid,
  );
  for (const query of [
    {},
    { conceptId: cid, userId: uid },
    { conceptId: [cid] },
    { conceptId: cid + '\n' },
    { conceptId: { $ne: null } },
  ])
    assert.equal(
      progressRequest.safeParse({ params: {}, query }).success,
      false,
    );
  assert.equal(
    progressRequest.safeParse({
      params: {},
      query: { conceptId: cid },
      body: {},
    }).success,
    false,
  );
  assert.throws(() =>
    progressDto(cid, { attemptCount: 0, startedAt: at, lastActivityAt: at }),
  );
  const stages = attemptStatsStages(
    new Types.ObjectId(uid),
    new Types.ObjectId(cid),
  );
  assert.deepEqual(stages[0], {
    $match: {
      userId: new Types.ObjectId(uid),
      conceptId: new Types.ObjectId(cid),
    },
  });
  assert(!JSON.stringify(stages).includes('studentAnswer'));
  assert(!JSON.stringify(stages).includes('explanation'));
});
test('fresh Student eligibility and response ownership are checked before and after reads', async () => {
  let reads = 0;
  let user = {
    id: uid,
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
  } as UserDto;
  const users = {
    async get() {
      return user;
    },
  };
  const service = createProgressService(
    {
      async read(owner, id) {
        reads++;
        assert.equal(owner, uid);
        return progressDto(id, {
          attemptCount: 0,
          startedAt: null,
          lastActivityAt: null,
        });
      },
    },
    users,
  );
  await assert.rejects(service.get({ sub: uid, role: 'ADMIN' }, cid), {
    code: 'AUTH_FORBIDDEN',
  });
  assert.equal(reads, 0);
  for (const patch of [
    { role: 'ADMIN' },
    { id: cid },
    { status: 'SUSPENDED' },
    { status: 'DISABLED' },
    { emailVerified: false },
  ]) {
    user = {
      id: uid,
      role: 'STUDENT',
      status: 'ACTIVE',
      emailVerified: true,
      ...patch,
    } as UserDto;
    await assert.rejects(service.get({ sub: uid, role: 'STUDENT' }, cid));
    assert.equal(reads, 0);
  }
  user = {
    id: uid,
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: true,
  } as UserDto;
  await service.get({ sub: uid, role: 'STUDENT' }, cid);
  assert.equal(reads, 1);
  const changed = createProgressService(
    {
      async read() {
        user = { ...user, role: 'ADMIN' };
        return progressDto(cid, {
          attemptCount: 0,
          startedAt: null,
          lastActivityAt: null,
        });
      },
    },
    users,
  );
  await assert.rejects(changed.get({ sub: uid, role: 'STUDENT' }, cid), {
    code: 'AUTH_FORBIDDEN',
  });
});
