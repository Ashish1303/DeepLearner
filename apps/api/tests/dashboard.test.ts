import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import {
  createAccessTokens,
  type AuthContext,
} from '../src/modules/auth/access-token.service.js';
import {
  completionPolicyFingerprint,
  conceptCompletionRules,
} from '../src/modules/concepts/concept.model.js';
import {
  createDashboardRepository,
  type DashboardStore,
} from '../src/modules/progress/dashboard.repository.js';
import { createDashboardService } from '../src/modules/progress/dashboard.service.js';
import {
  dashboardData,
  dashboardMasteryResult,
} from '../src/modules/progress/dashboard.dto.js';
import { dashboardQuery } from '../src/modules/progress/dashboard.schema.js';
import {
  createProgressRepository,
  type ProgressStore,
} from '../src/modules/progress/progress.repository.js';
import {
  progressRecord,
  emptyCompletionFields,
  type ProgressRecord,
} from '../src/modules/progress/progress.model.js';
import type { QualificationAuthority } from '../src/modules/progress/completion-evidence.service.js';
import type { MasteryPolicyResult } from '../src/modules/progress/mastery-policy.js';

const id = (n: number) => n.toString(16).padStart(24, '0');
const oid = (n: number) => new Types.ObjectId(id(n));
const owner = id(1),
  at = new Date('2026-10-22T00:00:00.000Z');
const forbidden = () =>
  new AppError(403, 'AUTH_FORBIDDEN', 'private-account-details');
function policy(concept: string) {
  const p = {
    policyId: id(501),
    version: 1,
    conceptId: concept,
    conceptRevision: 'a'.repeat(64),
    sourceEpoch: 'b'.repeat(64),
    requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
    minimumScore: 70,
    questionId: id(502),
    questionRevision: 'a'.repeat(64),
    contentFingerprint: 'c'.repeat(64),
    rubricId: id(503),
    rubricVersion: 1,
    rubricDefinitionFingerprint: 'd'.repeat(64),
    checkpointDefinitionId: id(504),
    checkpointFingerprint: 'e'.repeat(64),
    visualizationRevision: 'f'.repeat(64),
    authoredBy: id(505),
    authoredAt: at,
    state: 'APPROVED',
    approvedBy: id(506),
    approvedAt: at,
    revokedBy: null,
    revokedAt: null,
  };
  const fingerprint = completionPolicyFingerprint(
    p as Parameters<typeof completionPolicyFingerprint>[0],
  );
  return conceptCompletionRules.parse({
    schemaVersion: 1,
    decisionFence: 0,
    activeVersion: 1,
    versions: [{ ...p, fingerprint, approvedFingerprint: fingerprint }],
  });
}
// All adapters below are OFFLINE fixtures, not runtime ownership/authentication evidence.
function fixture(count = 1) {
  const rows = new Map<string, ProgressRecord>();
  for (let n = 10; n < 10 + count; n++)
    rows.set(
      id(n),
      progressRecord.parse({
        _id: oid(n + 1000),
        userId: oid(1),
        conceptId: oid(n),
        technologyId: oid(2),
        learningPathId: oid(3),
        moduleId: oid(4),
        topicId: oid(5),
        attemptCount: 2,
        status: 'IN_PROGRESS',
        startedAt: at,
        lastActivityAt: at,
        createdAt: at,
        updatedAt: at,
        schemaVersion: 1,
      }),
    );
  const state = {
    now: 0,
    eligible: true,
    role: 'STUDENT',
    live: true,
    sid: id(8),
    closed: 0,
    closeFails: false,
    repeats: 1,
    writes: 0,
    classCalls: 0,
    active: 0,
    maximum: 0,
    activeAtFinish: -1,
    stage: '',
    fail: '',
    final: false,
    phaseOptions: {} as Record<string, unknown>,
    hidden: new Set<string>(),
    policies: new Map<string, unknown>(),
    diagnostics: [] as unknown[],
    candidates: undefined as unknown[] | undefined,
    step: (stage: string) => {
      void stage;
    },
    result: { classification: 'STRONG', code: 'NONE' } as MasteryPolicyResult,
    classError: undefined as unknown,
    classHook: async (concept: string) => {
      void concept;
    },
  };
  function step(stage: string) {
    state.stage = stage;
    state.step(stage);
    if (state.fail === stage) throw Error('private-database-sentinel');
  }
  const origin: QualificationAuthority = {
    assert() {
      if (!state.live) throw Error('private-origin-sentinel');
    },
    async current() {
      throw Error('The dashboard must not grant authority itself');
    },
    async ready() {},
  };
  const session = {
    async withTransaction(
      fn: () => Promise<void>,
      options: Record<string, unknown>,
    ) {
      state.phaseOptions = options;
      for (let i = 0; i < state.repeats; i++) await fn();
    },
    async endSession(options: { timeoutMS: number }) {
      assert.equal(options.timeoutMS, 1000);
      state.closed++;
      step('close');
      if (state.closeFails) throw Error('private-cleanup-sentinel');
    },
  } as unknown as ClientSession;
  const hierarchy = (concept: Types.ObjectId) => ({
    conceptId: concept,
    technologyId: oid(2),
    learningPathId: oid(3),
    moduleId: oid(4),
    topicId: oid(5),
  });
  const progressStore: ProgressStore = {
    async ready() {},
    async session() {
      return session;
    },
    async hierarchy(concept) {
      return state.hidden.has(concept.toHexString())
        ? null
        : hierarchy(concept);
    },
    async stats(user, concept) {
      assert.equal(user.toHexString(), owner);
      const summary = rows.get(concept.toHexString())!;
      return {
        attemptCount: summary.attemptCount,
        startedAt: summary.startedAt,
        lastActivityAt: summary.lastActivityAt,
      };
    },
    async summaries(user, concept) {
      assert.equal(user.toHexString(), owner);
      return rows.has(concept.toHexString())
        ? [rows.get(concept.toHexString())!]
        : [];
    },
    async insert() {
      state.writes++;
      throw Error('No writes');
    },
    async update() {
      state.writes++;
      throw Error('No writes');
    },
  };
  const progress = createProgressRepository(progressStore, () => state.now);
  const store: DashboardStore = {
    async ready(ms) {
      step('ready');
      assert(ms > 0 && ms <= 5000);
    },
    async actor(user, read) {
      assert.equal(user, owner);
      if (read.timeoutMS !== undefined)
        assert(read.timeoutMS > 0 && read.timeoutMS <= 5000);
      step(state.final ? 'finalActor' : 'actor');
      if (!state.eligible) throw forbidden();
    },
    async candidates(user, cursor, read) {
      assert.equal(user, owner);
      assert.equal(read.majority, true);
      step('candidates');
      return (
        state.candidates ??
        [...rows.values()]
          .filter((r) => !cursor || r.conceptId.toHexString() > cursor)
          .slice(0, 101)
          .map((r) => ({
            _id: r._id,
            userId: r.userId,
            conceptId: r.conceptId,
          }))
      );
    },
    async published(concept) {
      step(state.final ? 'finalPublished' : 'published');
      return state.hidden.has(concept)
        ? null
        : {
            id: concept,
            title: 'Variables',
            slug: 'variables',
            difficulty: 'BEGINNER',
          };
    },
    async session(ms) {
      step('session');
      assert(ms > 0 && ms <= 5000);
      return session;
    },
    async prepare(user, concept, s) {
      step('prepare');
      return progress.prepare(user, concept, s);
    },
    async summary(user, concept) {
      assert.equal(user, owner);
      step('summary');
      return [rows.get(concept)!];
    },
    async policy(concept) {
      step('policy');
      return state.policies.get(concept) ?? null;
    },
    async assessments(user, concept) {
      assert.equal(user, owner);
      assert(rows.has(concept));
      step('assessments');
      return state.diagnostics;
    },
    authority(user, question) {
      assert.equal(user, owner);
      assert.equal(question, id(502));
      return origin;
    },
  };
  const repo = createDashboardRepository(store, () => state.now);
  const repository = {
    ...repo,
    async finish(...args: Parameters<typeof repo.finish>) {
      state.activeAtFinish = state.active;
      state.final = true;
      return repo.finish(...args);
    },
  };
  const actor = (): AuthContext => ({
    sub: owner,
    sid: state.sid,
    role: state.role as 'STUDENT' | 'ADMIN',
    plan: 'FREE',
  });
  const tokens = {
    async verify() {
      step('verify');
      return actor();
    },
  };
  const mastery = {
    async classify(input: unknown): Promise<MasteryPolicyResult> {
      const command = input as { accessToken: string; conceptId: string };
      assert.deepEqual(Object.keys(command).sort(), [
        'accessToken',
        'conceptId',
      ]);
      assert.equal(command.accessToken, 'offline-token');
      state.classCalls++;
      state.active++;
      state.maximum = Math.max(state.maximum, state.active);
      try {
        await state.classHook(command.conceptId);
        if (state.classError) throw state.classError;
        return state.result;
      } finally {
        state.active--;
      }
    },
  };
  const service = createDashboardService(
    tokens,
    { APP_ENV: 'LOCAL' },
    repository,
    mastery,
    () => state.now,
  );
  const read = (query: unknown = {}) =>
    service.read({ accessToken: 'offline-token', query });
  const supported = () => {
    for (const concept of rows.keys())
      state.policies.set(concept, policy(concept));
  };
  return {
    state,
    rows,
    store,
    repo,
    repository,
    tokens,
    mastery,
    service,
    read,
    supported,
    origin,
  };
}
const dependency = (error: unknown) => {
  assert(error instanceof AppError);
  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE');
  assert.equal(error.message, 'Dashboard is temporarily unavailable');
  return true;
};

test('default and explicit query limits have exact canonical cursor validation', () => {
  assert.deepEqual(dashboardQuery.parse({}), { limit: 5 });
  assert.deepEqual(dashboardQuery.parse({ limit: '1', cursor: id(10) }), {
    limit: 1,
    cursor: id(10),
  });
  for (const input of [
    { limit: '0' },
    { limit: '6' },
    { limit: 5 },
    { limit: '05' },
    { limit: '5\n' },
    { limit: ['5'] },
    { cursor: 'A'.repeat(24) },
    { cursor: '' },
    { cursor: [id(10)] },
    { score: 100 },
  ])
    assert.equal(dashboardQuery.safeParse(input).success, false);
});
test('empty owned activity is an exact empty page; current account is checked again', async () => {
  const f = fixture(0);
  const result = await f.read();
  assert.deepEqual(result, {
    items: [],
    pagination: { limit: 5, nextCursor: null },
  });
  assert.equal(f.state.final, true);
  assert.equal(f.state.closed, 0);
  assert.equal(f.state.classCalls, 0);
});
test('ordinary unqualified evidence yields explicit UNAVAILABLE without invented classification', async () => {
  const f = fixture();
  const result = await f.read();
  assert.deepEqual(result.items[0]!.mastery, {
    status: 'UNAVAILABLE',
    result: null,
    unavailableCode: 'LOCAL_QUALIFICATION_UNAVAILABLE',
  });
  assert.equal(result.items[0]!.activity.attemptCount, 2);
  assert.equal(f.state.writes, 0);
  assert.equal(f.state.classCalls, 0);
  assert.equal(f.state.closed, 1);
});
test('pagination is ascending exclusive with a visible lookahead and no duplicate on the next page', async () => {
  const f = fixture(8);
  const page = await f.read({ limit: '2' });
  assert.deepEqual(
    page.items.map((i) => i.concept.id),
    [id(10), id(11)],
  );
  assert.equal(page.pagination.nextCursor, id(11));
  const second = fixture(8);
  const next = await second.read({
    limit: '2',
    cursor: page.pagination.nextCursor,
  });
  assert.deepEqual(
    next.items.map((i) => i.concept.id),
    [id(12), id(13)],
  );
});
test('unknown cursor is only a position and does not require resource existence', async () => {
  assert.deepEqual((await fixture(2).read({ cursor: id(100) })).items, []);
});
test('unpublished ancestry is omitted without disclosing IDs or fabricating a full page', async () => {
  const f = fixture(4);
  f.state.hidden.add(id(10));
  f.state.hidden.add(id(12));
  const result = await f.read({ limit: '1' });
  assert.equal(result.items[0]!.concept.id, id(11));
  assert.equal(result.pagination.nextCursor, id(11));
  assert(!JSON.stringify(result).includes(id(12)));
});
test('at most 100 hidden candidates can establish exhaustion', async () => {
  const f = fixture(100);
  for (const concept of f.rows.keys()) f.state.hidden.add(concept);
  assert.deepEqual((await f.read()).items, []);
});
test('101st candidate is presence only: fail closed when a complete page cannot be established', async () => {
  const f = fixture(101);
  for (const concept of f.rows.keys()) f.state.hidden.add(concept);
  let checks = 0;
  f.state.step = (stage) => {
    if (stage === 'published') checks++;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(checks, 100);
});
test('finding the extra visible item within 100 candidates proves continuation', async () => {
  const f = fixture(101);
  for (let n = 10; n < 108; n++) f.state.hidden.add(id(n));
  const result = await f.read({ limit: '1' });
  assert.equal(result.items[0]!.concept.id, id(108));
  assert.equal(result.pagination.nextCursor, id(108));
});
test('wrong-owner candidate cannot escape repository scoping', async () => {
  const f = fixture();
  const row = [...f.rows.values()][0]!;
  f.state.candidates = [
    { _id: row._id, userId: oid(900), conceptId: row.conceptId },
  ];
  await assert.rejects(f.read(), dependency);
});
test('duplicate, unsorted, malformed or excessive candidates fail closed', async () => {
  for (const mode of ['duplicate', 'reverse', 'malformed', 'oversize']) {
    const f = fixture(2);
    const rows = [...f.rows.values()].map(({ _id, userId, conceptId }) => ({
      _id,
      userId,
      conceptId,
    }));
    f.state.candidates =
      mode === 'duplicate'
        ? [rows[0], rows[0]]
        : mode === 'reverse'
          ? rows.reverse()
          : mode === 'malformed'
            ? [{ ...rows[0], conceptId: id(10) }]
            : Array(102).fill(rows[0]);
    await assert.rejects(f.read(), dependency);
  }
});
test('current account denial and Admin role are forbidden, including empty pages', async () => {
  for (const mode of ['disabled', 'admin']) {
    const f = fixture(0);
    if (mode === 'disabled') f.state.eligible = false;
    else f.state.role = 'ADMIN';
    await assert.rejects(
      f.read(),
      (e: unknown) => e instanceof AppError && e.statusCode === 403,
    );
  }
});
test('account disablement before final response refuses success', async () => {
  const f = fixture();
  f.state.step = (s) => {
    if (s === 'finalActor') f.state.eligible = false;
  };
  await assert.rejects(
    f.read(),
    (e: unknown) => e instanceof AppError && e.statusCode === 403,
  );
});
test('account disablement during final source reads is rechecked after those reads', async () => {
  const f = fixture();
  f.state.step = (s) => {
    if (s === 'summary') f.state.eligible = false;
  };
  await assert.rejects(
    f.read(),
    (e: unknown) => e instanceof AppError && e.statusCode === 403,
  );
});
test('corrupt or inconsistent summaries are rejected by reused F037 preparation', async () => {
  for (const change of [
    { topicId: oid(99) },
    { attemptCount: 0 },
    { schemaVersion: 99 },
  ]) {
    const f = fixture();
    Object.assign(f.rows.get(id(10))!, change);
    await assert.rejects(f.read(), dependency);
    assert.equal(f.state.closed, 1);
  }
});
test('missing summary during the read is not repaired or replaced with zero', async () => {
  const f = fixture();
  f.state.step = (s) => {
    if (s === 'prepare') f.rows.delete(id(10));
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.writes, 0);
  assert.equal(f.state.closed, 1);
});
test('configured policy without live origin is not ordinary unavailability', async () => {
  const f = fixture();
  f.supported();
  f.store.authority = () => null;
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.classCalls, 0);
});
test('v2 existing qualification claim cannot downgrade to UNAVAILABLE after origin/policy loss', async () => {
  const f = fixture();
  const row = f.rows.get(id(10))!;
  f.rows.set(
    id(10),
    progressRecord.parse({
      ...row,
      schemaVersion: 2,
      ...emptyCompletionFields(),
      firstScore: 100,
      latestScore: 100,
      bestScore: 100,
    }),
  );
  await assert.rejects(f.read(), dependency);
});
test('malformed, qualifying or unbounded assessment evidence cannot prove ordinary absence', async () => {
  for (const records of [
    [{ purpose: 'COMPLETION_INPUT' }],
    [{ purpose: 'DIAGNOSTIC', score: 'invalid' }],
    Array(33).fill({}),
  ]) {
    const f = fixture();
    f.state.diagnostics = records;
    await assert.rejects(f.read(), dependency);
  }
});
test('a genuine-shaped B2 diagnostic score is never promoted to classification', async () => {
  const f = fixture(),
    hash = 'a'.repeat(64);
  f.state.diagnostics = [
    {
      _id: oid(600),
      userId: oid(1),
      attemptId: oid(601),
      questionId: oid(502),
      conceptId: oid(10),
      type: 'OUTPUT',
      questionRevision: hash,
      contentFingerprint: hash,
      attemptRequestFingerprint: hash,
      rubricId: oid(503),
      rubricVersion: 1,
      rubricDefinitionFingerprint: hash,
      graderId: 'OUTPUT_EXACT_TEXT',
      graderVersion: 1,
      purpose: 'DIAGNOSTIC',
      outcome: 'CORRECT',
      score: 100,
      refusalCode: null,
      evaluatedAt: at,
      requestedBy: oid(1),
      authorityId: oid(602),
      reviewerId: oid(506),
      approvalAuditId: oid(603),
      authorizationFence: 1,
      requestFingerprint: hash,
      schemaVersion: 1,
    },
  ];
  assert.equal((await f.read()).items[0]!.mastery.status, 'UNAVAILABLE');
  assert.equal(f.state.classCalls, 0);
});
test('malformed policy and dead connection generation refuse instead of manufacturing labels', async () => {
  const f = fixture();
  f.state.policies.set(id(10), { approved: true });
  await assert.rejects(f.read(), dependency);
  const g = fixture();
  g.supported();
  g.state.live = false;
  await assert.rejects(g.read(), dependency);
});
for (const result of [
  { classification: 'WEAK', code: 'NONE' },
  { classification: 'STRONG', code: 'NONE' },
  { classification: 'UNCLASSIFIED', code: 'SCORE_MISSING' },
  { classification: 'UNCLASSIFIED', code: 'STALE_ASSESSMENT' },
  { classification: 'UNCLASSIFIED', code: 'REVOKED_ASSESSMENT' },
] as const)
  test(`approved F039 outcome ${result.classification}/${result.code} retains its exact two fields`, async () => {
    const f = fixture();
    f.supported();
    f.state.result = result;
    assert.deepEqual((await f.read()).items[0]!.mastery, {
      status: 'EVALUATED',
      result,
      unavailableCode: null,
    });
    assert.equal(f.state.classCalls, 1);
    assert.equal(f.state.writes, 0);
  });
test('untrusted code, contradictory code or extra answer data from adapter refuses DTO', async () => {
  for (const result of [
    { classification: 'UNCLASSIFIED', code: 'INVALID_SCORE' },
    { classification: 'STRONG', code: 'STALE_ASSESSMENT' },
    { classification: 'STRONG', code: 'NONE', answer: 'private-answer' },
  ]) {
    const f = fixture();
    f.supported();
    f.state.result = result as MasteryPolicyResult;
    await assert.rejects(f.read(), dependency);
  }
});
test('ambiguous classifier 404, uncertain proof and index failure remain sanitized 503', async () => {
  for (const error of [
    new AppError(404, 'CONCEPT_NOT_FOUND', 'private'),
    new Error('private-proof'),
  ]) {
    const f = fixture();
    f.supported();
    f.state.classError = error;
    await assert.rejects(f.read(), dependency);
  }
  const f = fixture();
  f.state.fail = 'ready';
  await assert.rejects(f.read(), dependency);
});
test('five enrichments run concurrently and all settle before finalization even on failure', async () => {
  const f = fixture(5);
  f.supported();
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  f.state.classHook = async () => {
    if (f.state.active === 5) release();
    await barrier;
  };
  const result = await f.read();
  assert.equal(result.items.length, 5);
  assert.equal(f.state.maximum, 5);
  assert.equal(f.state.activeAtFinish, 0);
  const g = fixture(5);
  g.supported();
  g.state.classError = Error('private');
  await assert.rejects(g.read(), dependency);
  assert.equal(g.state.active, 0);
});
for (const [stage, elapsed] of [
  ['candidates', 5000],
  ['prepare', 5000],
  ['close', 5000],
  ['finalPublished', 30000],
] as const)
  test(`deadline expiration at ${stage} refuses success and disposes resources`, async () => {
    const f = fixture();
    f.state.step = (s) => {
      if (s === stage) f.state.now += elapsed;
    };
    await assert.rejects(f.read(), dependency);
    if (stage !== 'candidates') assert.equal(f.state.closed, 1);
  });
test('each discovery read observes recomputed remaining time', async () => {
  const f = fixture();
  const allowances: number[] = [];
  f.store.published = async (concept, read) => {
    if (!f.state.final) {
      allowances.push(read.timeoutMS!);
      f.state.now += 100;
      allowances.push(read.timeoutMS!);
    }
    return {
      id: concept,
      title: 'Variables',
      slug: 'variables',
      difficulty: 'BEGINNER',
    };
  };
  await f.read();
  assert(allowances[1]! < allowances[0]!);
});
test('classification does not start without ten seconds plus final reserve', async () => {
  const f = fixture();
  f.supported();
  f.state.step = (s) => {
    if (s === 'close') f.state.now = 19000;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.classCalls, 0);
});
test('deadline expiry after successful classifier proof cannot authorize response', async () => {
  const f = fixture();
  f.supported();
  f.state.classHook = async () => {
    f.state.now = 30000;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.active, 0);
});
test('a late child proof is refused at ten seconds even within the outer budget', async () => {
  const f = fixture();
  f.supported();
  f.state.classHook = async () => {
    f.state.now += 10000;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.now, 10000);
});
test('each enrichment rechecks admission rather than reusing the first allowance', async () => {
  const f = fixture(5);
  f.supported();
  f.state.classHook = async () => {
    f.state.now += 19000;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.classCalls, 1);
  assert.equal(f.state.active, 0);
});
test('origin validation cannot leave a stale admission allowance before proof', async () => {
  const f = fixture();
  f.supported();
  let assertions = 0;
  f.origin.assert = () => {
    if (++assertions === 2) f.state.now = 19000;
  };
  await assert.rejects(f.read(), dependency);
  assert.equal(f.state.classCalls, 0);
});
test('timely proof near the child boundary remains successful', async () => {
  const f = fixture();
  f.supported();
  f.state.classHook = async () => {
    f.state.now += 9999;
  };
  assert.equal((await f.read()).items[0]!.mastery.status, 'EVALUATED');
});
test('an ordinary context becoming configured before success refuses its old unavailable result', async () => {
  const f = fixture();
  f.state.step = (s) => {
    if (s === 'finalActor') f.supported();
  };
  await assert.rejects(f.read(), dependency);
});
test('final deadline check includes the last token verification', async () => {
  const f = fixture();
  f.state.step = (s) => {
    if (s === 'verify' && f.state.final) f.state.now = 30000;
  };
  await assert.rejects(f.read(), dependency);
});
test('failed cleanup refuses; dashboard callback is never automatically replayed', async () => {
  const f = fixture();
  f.state.closeFails = true;
  await assert.rejects(f.read(), dependency);
  const g = fixture();
  g.state.repeats = 2;
  await assert.rejects(g.read(), dependency);
  assert.equal(g.state.closed, 1);
  assert.equal(g.state.phaseOptions.timeoutMS, 4000);
});
test('native session creation refuses disconnected state without buffering or database access', async () => {
  assert.notEqual(mongoose.connection.readyState, 1);
  await assert.rejects(
    createDashboardRepository().activity(
      owner,
      [
        {
          id: id(10),
          title: 'Variables',
          slug: 'variables',
          difficulty: 'BEGINNER',
        },
      ],
      () => 30000,
    ),
    dependency,
  );
});
test('final source mutation, origin loss or withdrawn publication refuses', async () => {
  for (const change of ['policy', 'origin', 'publication', 'summary']) {
    const f = fixture();
    f.supported();
    f.state.classHook = async () => {
      if (change === 'policy') f.state.policies.set(id(10), null);
      if (change === 'origin') f.state.live = false;
      if (change === 'publication') f.state.hidden.add(id(10));
      if (change === 'summary') f.rows.get(id(10))!.attemptCount++;
    };
    await assert.rejects(f.read(), dependency);
  }
});
test('session/account replacement between proof and response is forbidden', async () => {
  const f = fixture();
  f.supported();
  f.state.classHook = async () => {
    f.state.sid = id(999);
  };
  await assert.rejects(
    f.read(),
    (e: unknown) => e instanceof AppError && e.statusCode === 403,
  );
});
test('strict command rejects client identity, scores and accessor execution', async () => {
  const f = fixture();
  let invoked = false;
  await assert.rejects(
    f.service.read({
      accessToken: 'offline-token',
      query: {},
      userId: owner,
      score: 100,
    }),
    (e: unknown) => e instanceof AppError && e.statusCode === 400,
  );
  await assert.rejects(
    f.service.read({
      get accessToken() {
        invoked = true;
        return 'bad';
      },
      query: {},
    }),
  );
  assert.equal(invoked, false);
});
test('exact public DTO excludes all internal context, score, ownership and binding data', async () => {
  const f = fixture();
  f.supported();
  const result = await f.read();
  assert.deepEqual(Object.keys(result).sort(), ['items', 'pagination']);
  assert.deepEqual(Object.keys(result.items[0]!).sort(), [
    'activity',
    'concept',
    'mastery',
  ]);
  assert.deepEqual(Object.keys(result.items[0]!.activity).sort(), [
    'attemptCount',
    'conceptId',
    'lastActivityAt',
    'startedAt',
    'status',
  ]);
  for (const forbidden of [
    'userId',
    'studentAnswer',
    'expectedAnswer',
    'fingerprint',
    'accessToken',
    'rubricId',
    'origin',
    'private-',
  ])
    assert(!JSON.stringify(result).includes(forbidden));
  assert.equal(
    dashboardData.safeParse({ ...result, private: true }).success,
    false,
  );
  assert.equal(
    dashboardMasteryResult.safeParse({
      classification: 'IMPROVING',
      code: 'NONE',
    }).success,
    true,
  );
});
test('non-LOCAL internal invocation stays unavailable and performs no reads', async () => {
  const f = fixture();
  let reads = 0;
  f.state.step = () => {
    reads++;
  };
  const service = createDashboardService(
    f.tokens,
    { APP_ENV: 'PRODUCTION' },
    f.repository,
    f.mastery,
  );
  await assert.rejects(
    service.read({ accessToken: 'offline-token', query: {} }),
    (e: unknown) => e instanceof AppError && e.statusCode === 404,
  );
  assert.equal(reads, 0);
});
test('genuine access-token signature and expiry verification is reused without fabricating sessions', async () => {
  const f = fixture(0),
    config = {
      ACCESS_TOKEN_SECRET: randomBytes(32).toString('base64'),
      ACCESS_TOKEN_ISSUER: 'offline-dashboard-test',
      ACCESS_TOKEN_AUDIENCE: 'offline-dashboard-test',
    };
  const tokens = createAccessTokens(config);
  const token = await tokens.sign({
    sub: owner,
    sid: id(8),
    role: 'STUDENT',
    plan: 'FREE',
  });
  const service = createDashboardService(
    tokens,
    { APP_ENV: 'LOCAL' },
    f.repository,
    f.mastery,
  );
  assert.equal(
    (await service.read({ accessToken: token, query: {} })).items.length,
    0,
  );
  await assert.rejects(
    service.read({ accessToken: token + 'x', query: {} }),
    (e: unknown) => e instanceof AppError && e.statusCode === 401,
  );
});
test('native adapter preserves exact owner/index/query bounds and has no mutation or mounted route', () => {
  const repository = readFileSync(
    new URL('../src/modules/progress/dashboard.repository.ts', import.meta.url),
    'utf8',
  );
  const service = readFileSync(
    new URL('../src/modules/progress/dashboard.service.ts', import.meta.url),
    'utf8',
  );
  assert(repository.includes('publishedConceptStages(id)'));
  assert(
    repository.includes('progressRepository.prepare(owner, concept, session)'),
  );
  assert(repository.includes('.limit(101)'));
  assert(repository.includes('.limit(33)'));
  assert(repository.includes('hint: progressIndex.name'));
  for (const source of [repository, service])
    for (const operation of [
      '.save(',
      '.insertOne(',
      '.updateOne(',
      '.deleteOne(',
      'Router(',
      'console.',
      'logger.',
    ])
      assert(!source.includes(operation), operation);
  assert(service.includes('version: 1'));
  assert(service.includes('improvingMinimum: 60'));
  assert(service.includes('strongMinimum: 80'));
});
