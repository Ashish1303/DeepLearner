import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import { AppError } from '../src/common/errors/app-error.js';
import {
  conceptCompletionPolicy,
  completionPolicyFingerprint,
} from '../src/modules/concepts/concept.model.js';
import {
  createCompletionRepository,
  buildCompletionView,
  completionIndexes,
  verifyCompletionIndex,
  mongoCompletionStore,
  type CompletionStore,
  type CompletionScope,
  type CompletionSources,
} from '../src/modules/progress/completion.repository.js';
import { createCompletionService } from '../src/modules/progress/completion.service.js';
import {
  progressV2Record,
  progressRecord,
  type ProgressRecord,
} from '../src/modules/progress/progress.model.js';
import {
  completionRequestRecord,
  CompletionRequestReceipt,
  type CompletionRequest,
} from '../src/modules/progress/completion-request.model.js';
import {
  completionView,
  completionGraph,
  completionUnavailable,
  completionIssueRequest,
  completionResponseBody,
} from '../src/modules/progress/completion.schema.js';
import { createPracticeAttemptCoordination } from '../src/modules/practice/practice-attempt.repository.js';
import { mongoQualification } from '../src/modules/progress/section-evidence.repository.js';
import {
  issueFingerprint,
  ackFingerprint,
} from '../src/modules/progress/section-evidence.service.js';
import {
  acknowledgementChallengeRecord,
  visualChallengeRecord,
} from '../src/modules/progress/section-evidence-challenge.model.js';
import { visualReceiptRecord } from '../src/modules/progress/section-evidence-receipt.model.js';
import { checkpointDefinitionRecord } from '../src/modules/visualizations/visualization-checkpoint-definition.model.js';
import {
  definitionFingerprint,
  checkpointPolicy,
} from '../src/modules/visualizations/visualization-checkpoint-revision.js';
import {
  checkpointIssueFingerprint,
  checkpointResponseFingerprint,
} from '../src/modules/visualizations/visualization-checkpoint.service.js';
import type { AttemptRecord } from '../src/modules/practice/practice-attempt.model.js';
import type { CompletionAssessmentRecord } from '../src/modules/practice/practice-assessment.model.js';
import type { UserDto } from '../src/modules/users/user.dto.js';

const oid = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const owner = oid(1).toHexString(),
  concept = oid(2).toHexString();
function fixture() {
  const at = new Date(Date.now() - 1000),
    hash = 'a'.repeat(64);
  const p = {
    policyId: oid(8).toHexString(),
    version: 1,
    conceptId: concept,
    conceptRevision: hash,
    sourceEpoch: 'b'.repeat(64),
    requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'],
    minimumScore: 70,
    questionId: oid(3).toHexString(),
    questionRevision: hash,
    contentFingerprint: hash,
    rubricId: oid(4).toHexString(),
    rubricVersion: 1,
    rubricDefinitionFingerprint: hash,
    checkpointDefinitionId: oid(5).toHexString(),
    checkpointFingerprint: hash,
    visualizationRevision: hash,
    authoredBy: oid(6).toHexString(),
    authoredAt: at,
    state: 'APPROVED',
    approvedBy: oid(7).toHexString(),
    approvedAt: at,
    approvedFingerprint: hash,
    revokedBy: null,
    revokedAt: null,
    fingerprint: hash,
    // fingerprint is filled before parsing below.
  };
  return fixtureWithPolicy(p, at);
}
function fixtureWithPolicy(policyInput: Record<string, unknown>, at: Date) {
  const p = { ...policyInput } as unknown as CompletionScope['policy'] & {};
  p.fingerprint = completionPolicyFingerprint(p);
  p.approvedFingerprint = p.fingerprint;
  conceptCompletionPolicy.parse(p);
  const hierarchy = {
    conceptId: oid(2),
    technologyId: oid(20),
    learningPathId: oid(21),
    moduleId: oid(22),
    topicId: oid(23),
  };
  const initial = progressRecord.parse({
    _id: oid(9),
    userId: oid(1),
    ...hierarchy,
    attemptCount: 1,
    status: 'IN_PROGRESS',
    startedAt: at,
    lastActivityAt: at,
    createdAt: at,
    updatedAt: at,
    schemaVersion: 1,
  });
  const attempt: AttemptRecord = {
    _id: oid(10),
    userId: oid(1),
    conceptId: oid(2),
    questionId: oid(3),
    type: 'OUTPUT',
    questionRevision: p.questionRevision,
    contentFingerprint: p.contentFingerprint,
    attemptNumber: 1,
    studentAnswer: 'Synthetic answer',
    submittedAt: at,
    result: 'SUBMITTED',
    score: null,
    idempotencyKeyHash: 'c'.repeat(64),
    requestFingerprint: 'd'.repeat(64),
    schemaVersion: 1,
  };
  const grade: CompletionAssessmentRecord = {
    _id: oid(11),
    userId: oid(1),
    attemptId: attempt._id,
    questionId: oid(3),
    conceptId: oid(2),
    type: 'OUTPUT',
    questionRevision: p.questionRevision,
    contentFingerprint: p.contentFingerprint,
    attemptRequestFingerprint: attempt.requestFingerprint,
    rubricId: oid(4),
    rubricVersion: 1,
    rubricDefinitionFingerprint: p.rubricDefinitionFingerprint,
    graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
    graderVersion: 1,
    purpose: 'COMPLETION_INPUT',
    outcome: 'CORRECT',
    score: 100,
    refusalCode: null,
    evaluatedAt: at,
    requestedBy: oid(1),
    authorityId: oid(30),
    reviewerId: oid(7),
    approvalAuditId: oid(31),
    authorizationFence: 1,
    requestFingerprint: 'e'.repeat(64),
    schemaVersion: 2,
    policyId: oid(8),
    policyVersion: 1,
    policyFingerprint: p.fingerprint,
    sourceEpoch: p.sourceEpoch,
    submissionProvenance: 'F036_FIRST_SUBMISSION_ATOMIC_V1',
    attemptNumber: 1,
  };
  const state = {
    summary: initial as ProgressRecord | null,
    requests: [] as CompletionRequest[],
    events: [] as string[],
    now: 0,
    live: true,
    scopeState: 'CURRENT' as CompletionScope['state'],
    actions: ['READ', 'VISUALIZE', 'EXAMPLE'].map((s, i) => ({
      section: s,
      status: 'QUALIFIED',
      receiptId: oid(40 + i).toHexString(),
    })) as CompletionSources['actions'],
    grade: grade as CompletionAssessmentRecord | null,
    attempt: attempt as AttemptRecord | null,
    indexReady: true,
    saveFailure: false,
    proofFailure: false,
    unknown: false,
    cleanupFailure: false,
    reenter: 0,
    options: {} as Record<string, unknown>,
    saves: 0,
    proofs: 0,
    denied: false,
    scopeRev: 'a'.repeat(64),
    selectedLost: false,
  };
  let queue = Promise.resolve();
  const origin = {
    assert() {
      if (!state.live) throw completionUnavailable();
    },
    async current() {
      return p;
    },
    async ready() {},
  };
  const makeScope = () =>
    ({
      owner,
      conceptId: concept,
      conceptRevision: state.scopeRev,
      policy: p,
      state: state.scopeState,
      origin,
      checkpoint: null,
      visualization: null,
    }) satisfies CompletionScope;
  const makeSources = (selected = false): CompletionSources => ({
    actions: state.actions.map((a) => ({
      ...a,
      ...(selected && state.selectedLost ? { status: 'REVOKED' as const } : {}),
    })),
    attempt: state.attempt,
    assessment: state.grade,
    practiceStatus: !state.attempt
      ? 'MISSING'
      : !state.grade
        ? 'UNQUALIFIED'
        : state.grade.score === 100
          ? 'QUALIFIED'
          : 'BELOW_THRESHOLD',
  });
  const store: CompletionStore = {
    async ready(ms) {
      assert(ms > 0);
      if (!state.indexReady) throw completionUnavailable();
    },
    async session() {
      const session = {
        async withTransaction(
          fn: () => Promise<void>,
          options: Record<string, unknown>,
        ) {
          const previous = queue;
          let release!: () => void;
          queue = new Promise<void>((r) => {
            release = r;
          });
          await previous;
          const summary = state.summary,
            requests = [...state.requests];
          state.options = options;
          try {
            for (let i = 0; i <= state.reenter; i++) await fn();
            state.events.push('commit');
            if (state.unknown) {
              const e = Object.assign(new Error('sanitized'), {
                errorLabels: ['UnknownTransactionCommitResult'],
              });
              throw e;
            }
          } catch (e) {
            if (!state.unknown) {
              state.summary = summary;
              state.requests = requests;
            }
            throw e;
          } finally {
            release();
          }
        },
        async endSession() {
          state.events.push('cleanup');
          if (state.cleanupFailure) throw Error('sanitized');
        },
        inTransaction: () => true,
      } as unknown as ClientSession;
      return session;
    },
    async scope(who, id, read, fence) {
      origin.assert();
      assert.equal(who, owner);
      assert.equal(id, concept);
      if (state.denied) throw new AppError(403, 'AUTH_FORBIDDEN', 'Forbidden');
      if (fence) {
        assert(read.session);
        state.events.push('policy-rubric-definition-fences');
      }
      return makeScope();
    },
    async sources(scope, read, fence, claim) {
      assert.equal(scope.owner, owner);
      if (fence) {
        state.events.push('challenge-fences');
        assert(read.session);
      }
      if (read.majority) state.proofs++;
      return makeSources(!!claim);
    },
    async progress() {
      return {
        userId: oid(1),
        hierarchy,
        stats: { attemptCount: 1, startedAt: at, lastActivityAt: at },
        summary: state.summary,
        session: {} as ClientSession,
      };
    },
    async summary(_owner, _concept, read) {
      assert.equal(read.majority, true);
      state.events.push('majority-summary');
      return state.proofFailure ? null : state.summary;
    },
    async request(who, key, read) {
      assert.equal(who, owner);
      if (read.majority) state.events.push('majority-request');
      return state.requests.find((r) => r.requestKeyHash === key) ?? null;
    },
    async requestById(who, id, read) {
      assert.equal(who, owner);
      assert(read.session);
      return state.requests.find((r) => r._id.equals(id)) ?? null;
    },
    async save(before, after, receipt, read) {
      assert(read.session);
      assert.deepEqual(before, state.summary);
      progressV2Record.parse(after);
      completionRequestRecord.parse(receipt);
      state.events.push('save');
      state.summary = after;
      state.requests.push(receipt);
      state.saves++;
      if (state.saveFailure) throw Error('sanitized');
    },
    async challenge() {
      return { section: 'READ' };
    },
  };
  const repository = createCompletionRepository(store, () => state.now, null);
  const users = {
    async get() {
      return {
        id: owner,
        role: state.denied ? 'ADMIN' : 'STUDENT',
        status: 'ACTIVE',
        emailVerified: true,
      } as UserDto;
    },
  };
  const service = createCompletionService(
    {
      async verify() {
        return { sub: owner, role: 'STUDENT' } as never;
      },
    },
    { APP_ENV: 'LOCAL' },
    repository,
    users,
  );
  return {
    p,
    state,
    store,
    repository,
    service,
    origin,
    makeScope,
    makeSources,
    at,
    subject: { sub: owner, role: 'STUDENT' },
    get: () => repository.read(owner, concept),
    complete: (view: string, key = randomUUID()) =>
      repository.complete(owner, concept, view, key),
  };
}

test('complete coverage invokes Stage A with genuine original passing evidence and returns exact nine-field view', async () => {
  const f = fixture(),
    before = JSON.stringify(f.state.summary),
    v = await f.get();
  assert.equal(v.eligibility, 'ELIGIBLE');
  assert.equal(v.practice.score, 100);
  assert.equal(v.completion.status, 'NOT_COMPLETED');
  assert.deepEqual(
    Object.keys(v).sort(),
    [
      'conceptId',
      'viewRevision',
      'requiredSections',
      'sections',
      'practice',
      'eligibility',
      'blockers',
      'completion',
      'visualization',
    ].sort(),
  );
  assert.equal(JSON.stringify(f.state.summary), before);
  assert.equal(f.state.saves, 0);
  assert.equal(f.state.requests.length, 0);
});
test('explicit completion atomically stores canonical claim and private request before majority proof and response', async () => {
  const f = fixture(),
    v = await f.get(),
    saved = await f.complete(v.viewRevision);
  assert.equal(saved.completion.status, 'COMPLETED');
  assert.equal(f.state.requests.length, 1);
  assert.equal(f.state.summary?.schemaVersion, 2);
  assert(
    f.state.events.indexOf('policy-rubric-definition-fences') <
      f.state.events.indexOf('challenge-fences'),
  );
  assert(
    f.state.events.indexOf('save') <
      f.state.events.lastIndexOf('majority-summary'),
  );
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert(f.state.proofs > 0);
  assert(!JSON.stringify(saved).includes('Synthetic answer'));
  assert.equal('assessmentId' in saved, false);
});
test('same-request replay returns the same decision; a different key preserves completedAt and records only request history', async () => {
  const f = fixture(),
    v = await f.get(),
    key = randomUUID();
  const a = await f.complete(v.viewRevision, key),
    b = await f.complete(v.viewRevision, key);
  assert.deepEqual(a, b);
  assert.equal(f.state.requests.length, 1);
  const claim = JSON.stringify(f.state.summary);
  const c = await f.complete(v.viewRevision);
  assert.deepEqual(c, a);
  assert.equal(f.state.requests.length, 2);
  assert.equal(JSON.stringify(f.state.summary), claim);
});
test('same-key changed frozen view conflicts without new persistence', async () => {
  const f = fixture(),
    v = await f.get(),
    key = randomUUID();
  await f.complete(v.viewRevision, key);
  await assert.rejects(f.complete('f'.repeat(64), key), {
    code: 'COMPLETION_IDEMPOTENCY_CONFLICT',
  });
  assert.equal(f.state.requests.length, 1);
});
test('concurrent identical completions converge to one claim and request without duplicate counts', async () => {
  const f = fixture(),
    v = await f.get(),
    key = randomUUID(),
    [a, b] = await Promise.all([
      f.complete(v.viewRevision, key),
      f.complete(v.viewRevision, key),
    ]);
  assert.deepEqual(a, b);
  assert.equal(f.state.requests.length, 1);
  assert.equal(f.state.summary?.attemptCount, 1);
});
test('every required section is necessary; optional Revise is not invented', async () => {
  for (const section of ['READ', 'VISUALIZE', 'EXAMPLE'] as const) {
    const f = fixture();
    f.state.actions.find((a) => a.section === section)!.status = 'MISSING';
    const v = await f.get();
    assert.equal(v.eligibility, 'INELIGIBLE');
    assert(v.blockers.some((b) => b.section === section));
    await assert.rejects(f.complete(v.viewRevision));
    assert.equal(f.state.requests.length, 0);
  }
  const f = fixture();
  f.p.requiredSections.push('REVISE');
  const v = await f.get();
  assert.equal(v.eligibility, 'INELIGIBLE');
  assert(v.blockers.some((b) => b.section === 'REVISE'));
});
test('zero first score is genuinely below 70; absent and ungraded sources are never fabricated passing evidence', async () => {
  for (const mode of ['zero', 'missing-grade', 'missing-attempt'] as const) {
    const f = fixture();
    if (mode === 'zero') {
      f.state.grade!.score = 0;
      f.state.grade!.outcome = 'INCORRECT';
    } else if (mode === 'missing-grade') f.state.grade = null;
    else f.state.attempt = null;
    const v = await f.get();
    assert.equal(v.eligibility, 'INELIGIBLE');
    assert.equal(v.practice.score, mode === 'zero' ? 0 : null);
    await assert.rejects(f.complete(v.viewRevision));
    assert.equal(f.state.summary?.schemaVersion, 1);
  }
});
test('stale or revoked policy cannot produce or continue effective completion', async () => {
  for (const state of ['STALE', 'REVOKED', 'MISSING'] as const) {
    const f = fixture(),
      v = await f.get();
    await f.complete(v.viewRevision);
    f.state.scopeState = state;
    const current = await f.get();
    assert.equal(current.eligibility, 'INELIGIBLE');
    assert.notEqual(current.completion.status, 'COMPLETED');
    assert.equal(f.state.requests.length, 1);
  }
});
test('withdrawal of a bound receipt cannot be masked by another eligible action or silently restore the old claim', async () => {
  const f = fixture(),
    v = await f.get(),
    key = randomUUID();
  await f.complete(v.viewRevision, key);
  f.state.selectedLost = true;
  const current = await f.get();
  assert.equal(current.eligibility, 'ELIGIBLE');
  assert.equal(current.completion.status, 'REVOKED');
  await assert.rejects(f.complete(v.viewRevision, key), {
    code: 'COMPLETION_RECEIPT_UNAVAILABLE',
  });
});
test('summary/request failure rolls back atomically without claiming completion', async () => {
  const f = fixture(),
    v = await f.get();
  f.state.saveFailure = true;
  await assert.rejects(f.complete(v.viewRevision));
  assert.equal(f.state.summary?.schemaVersion, 1);
  assert.equal(f.state.requests.length, 0);
});
test('uncertain commit keeps possible durable history but never returns success; exact retry proves it', async () => {
  const f = fixture(),
    v = await f.get(),
    key = randomUUID();
  f.state.unknown = true;
  await assert.rejects(f.complete(v.viewRevision, key), {
    code: 'COMPLETION_COMMIT_UNCONFIRMED',
  });
  assert.equal(f.state.requests.length, 1);
  f.state.unknown = false;
  assert.equal(
    (await f.complete(v.viewRevision, key)).completion.status,
    'COMPLETED',
  );
});
test('missing majority proof and failed cleanup suppress success without pretending committed history vanished', async () => {
  for (const flag of ['proofFailure', 'cleanupFailure'] as const) {
    const f = fixture(),
      v = await f.get();
    f.state[flag] = true;
    await assert.rejects(f.complete(v.viewRevision));
    assert.equal(f.state.requests.length, 1);
  }
});
test('readiness and generation loss fail closed before writes', async () => {
  for (const flag of ['indexReady', 'live'] as const) {
    const f = fixture(),
      v = await f.get();
    f.state[flag] = false;
    await assert.rejects(f.complete(v.viewRevision));
    assert.equal(f.state.requests.length, 0);
  }
});
test('fresh ownership and current Student authorization are mandatory for both reads and completion', async () => {
  const f = fixture();
  await assert.rejects(f.service.get({ sub: owner, role: 'ADMIN' }, concept));
  f.state.denied = true;
  await assert.rejects(f.service.get(f.subject, concept));
  assert.equal(f.state.requests.length, 0);
});
test('LOCAL-only service cannot be activated by request fields or caller role claims', async () => {
  const f = fixture(),
    service = createCompletionService(
      { verify: async () => ({ sub: owner, role: 'STUDENT' }) as never },
      { APP_ENV: 'PROD' },
      f.repository,
      { get: async () => ({}) as UserDto },
    );
  await assert.rejects(service.get(f.subject, concept), {
    code: 'ROUTE_NOT_FOUND',
  });
  assert.equal(f.state.saves, 0);
});
test('three-body guard and elapsed reserve remain enforced without budget reset', async () => {
  const f = fixture(),
    v = await f.get();
  f.state.reenter = 3;
  await assert.rejects(f.complete(v.viewRevision));
  assert.equal(f.state.requests.length, 0);
  const g = fixture(),
    w = await g.get(),
    scope = g.store.scope;
  g.store.scope = async (...args) => {
    g.state.now = 11000;
    return scope(...args);
  };
  await assert.rejects(g.complete(w.viewRevision));
});
test('exact schemas refuse external authority, answers, unsupported actions and unsafe graph data', () => {
  assert(
    !completionIssueRequest.shape.body.safeParse({ section: 'PRACTICE' })
      .success,
  );
  assert(
    !completionIssueRequest.shape.body.safeParse({
      section: 'READ',
      approved: true,
    }).success,
  );
  assert(
    !completionResponseBody.safeParse({
      challengeId: concept,
      selectedChoiceId: ' x',
    }).success,
  );
  assert(
    !completionGraph.safeParse({
      type: 'ANIMATED_FLOW',
      expectedChoiceId: 'private',
    }).success,
  );
  const f = fixture(),
    view = buildCompletionView({
      scope: f.makeScope(),
      sources: f.makeSources(),
      progress: {
        userId: oid(1),
        hierarchy: {
          conceptId: oid(2),
          technologyId: oid(20),
          learningPathId: oid(21),
          moduleId: oid(22),
          topicId: oid(23),
        },
        stats: { attemptCount: 1, startedAt: f.at, lastActivityAt: f.at },
        summary: f.state.summary,
        session: {} as ClientSession,
      },
    });
  assert(!completionView.safeParse({ ...view, answer: 'sensitive' }).success);
});
test('request receipt is strict append-only and its sole declared unique index is in the thirteen-index manifest', async () => {
  const f = fixture(),
    v = await f.get();
  await f.complete(v.viewRevision);
  const receipt = f.state.requests[0]!;
  assert.throws(() =>
    completionRequestRecord.parse({ ...receipt, answer: 'sensitive' }),
  );
  const doc = new CompletionRequestReceipt(receipt);
  doc.isNew = false;
  await assert.rejects(doc.save(), /append-only/);
  await assert.rejects(CompletionRequestReceipt.deleteMany({}), /append-only/);
  assert.equal(CompletionRequestReceipt.schema.get('autoIndex'), false);
  assert.equal(completionIndexes.length, 13);
  assert.equal(CompletionRequestReceipt.db.readyState, 0);
});
test('all thirteen exact definitions reject missing, reordered, nonunique and alternate index options', () => {
  for (const i of completionIndexes) {
    const valid = {
      v: 2,
      key: i.key,
      name: i.name,
      ...(i.unique ? { unique: true } : {}),
    };
    verifyCompletionIndex([valid], i);
    for (const rows of [
      [],
      [valid, valid],
      [{ ...valid, name: 'wrong' }],
      [{ ...valid, v: 1 }],
      [{ ...valid, unique: !i.unique }],
      [{ ...valid, hidden: false }],
      [{ ...valid, collation: { locale: 'simple' } }],
      [{ ...valid, key: Object.fromEntries(Object.entries(i.key).reverse()) }],
    ]) {
      // Single-field keys do not exist in this manifest; reversing must differ.
      assert.throws(() => verifyCompletionIndex(rows, i), {
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    }
  }
});
test('orphaned, superseded or incorrectly owned durable request proof cannot establish GET completion', async () => {
  for (const fault of ['missing', 'owner', 'version', 'fingerprint'] as const) {
    const f = fixture(),
      v = await f.get();
    await f.complete(v.viewRevision);
    const original = f.state.requests[0]!;
    if (fault === 'missing') f.state.requests = [];
    if (fault === 'owner') original.userId = oid(55);
    if (fault === 'version') original.decisionVersion++;
    if (fault === 'fingerprint') original.requestFingerprint = '0'.repeat(64);
    await assert.rejects(f.get());
  }
});
test('completion coordination uses completion error codes and followers still perform their own durable proof', async () => {
  const f = fixture(),
    v = await f.get(),
    client = {},
    database = {};
  const gate = createPracticeAttemptCoordination({
    local: () => true,
    generation: () => ({ client, database, live: true }),
    onLoss: () => () => {},
  });
  const repository = createCompletionRepository(
    f.store,
    () => f.state.now,
    gate,
  );
  let release!: () => void, entered!: () => void;
  const arrived = new Promise<void>((r) => {
      entered = r;
    }),
    wait = new Promise<void>((r) => {
      release = r;
    }),
    save = f.store.save;
  f.store.save = async (...args) => {
    entered();
    await wait;
    return save(...args);
  };
  const key = randomUUID(),
    first = repository.complete(owner, concept, v.viewRevision, key);
  await arrived;
  const follower = repository.complete(owner, concept, v.viewRevision, key);
  await assert.rejects(
    repository.complete(owner, concept, 'f'.repeat(64), key),
    { code: 'COMPLETION_IDEMPOTENCY_CONFLICT' },
  );
  release();
  const [a, b] = await Promise.all([first, follower]);
  assert.deepEqual(a, b);
  assert.equal(f.state.requests.length, 1);
  assert(f.state.proofs >= 2);
});
test('native receipt validation accepts a current consumed Read action after expiry, rejects withdrawal and forged ownership', async (t) => {
  const f = fixture(),
    now = Date.now(),
    issuedAt = new Date(now - 600000),
    at = new Date(now - 500000),
    id = oid(80),
    receiptId = oid(81);
  f.p.approvedAt = new Date(now - 900000);
  f.p.authoredAt = f.p.approvedAt;
  const c = acknowledgementChallengeRecord.parse({
    _id: id,
    userId: oid(1),
    conceptId: oid(2),
    section: 'READ',
    schemaVersion: 1,
    producerVersion: 1,
    policyId: 'F038_READ_ACK_ACTIVITY',
    policyVersion: 1,
    conceptRevision: f.p.conceptRevision,
    sectionRevision: 'f'.repeat(64),
    issueKeyHash: 'e'.repeat(64),
    requestFingerprint: 'd'.repeat(64),
    issueRequestId: 'issue',
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 300000),
    state: 'CONSUMED',
    decisionFence: 1,
    consumedAt: at,
    receiptId,
    revokedAt: null,
    revokedBy: null,
  });
  c.requestFingerprint = issueFingerprint(c);
  const r = {
    _id: receiptId,
    userId: oid(1),
    conceptId: oid(2),
    section: 'READ',
    schemaVersion: 1,
    producerVersion: 1,
    policyId: 'F038_READ_ACK_ACTIVITY',
    policyVersion: 1,
    conceptRevision: c.conceptRevision,
    sectionRevision: c.sectionRevision,
    challengeId: id,
    origin: 'ACKNOWLEDGEMENT_SERVICE',
    purpose: 'ACTIVITY_ONLY',
    ackKeyHash: 'c'.repeat(64),
    requestFingerprint: ackFingerprint(c),
    ackRequestId: 'ack',
    acknowledgedAt: at,
  };
  t.mock.method(
    mongoQualification,
    'actions',
    async (_owner: string, _concept: string, section: string) =>
      section === 'READ' ? [{ challenge: c, receipt: r }] : [],
  );
  t.mock.method(
    mongoQualification,
    'sectionRevision',
    async () => c.sectionRevision,
  );
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: {
      collection(name: string) {
        assert.equal(name, 'practiceAttempts');
        return {
          find() {
            return {
              limit() {
                return {
                  async toArray() {
                    return [];
                  },
                };
              },
            };
          },
        };
      },
    },
  });
  try {
    assert.equal(
      (
        await mongoCompletionStore.sources(f.makeScope(), {}, false)
      ).actions.find((a) => a.section === 'READ')!.status,
      'QUALIFIED',
    );
    c.state = 'REVOKED';
    c.revokedAt = new Date(now - 1000);
    c.revokedBy = oid(1);
    assert.equal(
      (
        await mongoCompletionStore.sources(f.makeScope(), {}, false)
      ).actions.find((a) => a.section === 'READ')!.status,
      'REVOKED',
    );
    r.userId = oid(99);
    await assert.rejects(
      mongoCompletionStore.sources(f.makeScope(), {}, false),
    );
  } finally {
    if (descriptor)
      Object.defineProperty(mongoose.connection, 'db', descriptor);
    else Reflect.deleteProperty(mongoose.connection, 'db');
  }
});
test('native action discovery refuses overflow at the bounded sentinel without collecting more documents', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  let requested = 0;
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: {
      collection(name: string) {
        assert.equal(name, 'sectionActivityReceipts');
        return {
          find() {
            return {
              sort() {
                return {
                  limit(n: number) {
                    requested = n;
                    return {
                      async toArray() {
                        return Array.from({ length: 33 }, () => ({}));
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  });
  try {
    await assert.rejects(
      mongoQualification.actions(owner, concept, 'READ', {}),
    );
    assert.equal(requested, 33);
  } finally {
    if (descriptor)
      Object.defineProperty(mongoose.connection, 'db', descriptor);
    else Reflect.deleteProperty(mongoose.connection, 'db');
  }
});
test('native Visualize proof rejects a contradictory receipt definition ID even when other bindings and response hash match', async (t) => {
  const f = fixture(),
    issuedAt = new Date(Date.now() - 500),
    respondedAt = new Date(Date.now() - 100);
  const raw = {
    _id: oid(5),
    schemaVersion: 1 as const,
    conceptId: oid(2),
    visualizationId: oid(60),
    conceptRevision: f.p.conceptRevision,
    visualizationRevision: f.p.visualizationRevision,
    checkpointId: 'retained',
    checkpointVersion: 1,
    ...checkpointPolicy,
    responseType: 'SINGLE_CHOICE' as const,
    choices: [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ],
    expectedChoiceId: 'yes',
    prompt: 'Which remains?',
    textAlternative: 'A retained node.',
    definitionFingerprint: 'a'.repeat(64),
    authoredBy: oid(6),
    authoredAt: f.at,
    authorRequestId: 'author',
    state: 'APPROVED' as const,
    decisionFence: 1,
    approvedBy: oid(7),
    approvedAt: f.at,
    approvedFingerprint: 'a'.repeat(64),
    revokedBy: null,
    revokedAt: null,
  };
  raw.definitionFingerprint = definitionFingerprint(raw);
  raw.approvedFingerprint = raw.definitionFingerprint;
  const d = checkpointDefinitionRecord.parse(raw);
  f.p.checkpointFingerprint = d.definitionFingerprint;
  f.p.fingerprint = completionPolicyFingerprint(f.p);
  f.p.approvedFingerprint = f.p.fingerprint;
  const c = visualChallengeRecord.parse({
    _id: oid(80),
    userId: oid(1),
    conceptId: oid(2),
    section: 'VISUALIZE',
    schemaVersion: 2,
    producerVersion: 1,
    ...checkpointPolicy,
    definitionId: d._id,
    definitionFingerprint: d.definitionFingerprint,
    visualizationId: d.visualizationId,
    visualizationRevision: d.visualizationRevision,
    checkpointId: d.checkpointId,
    checkpointVersion: d.checkpointVersion,
    conceptRevision: d.conceptRevision,
    sectionRevision: d.visualizationRevision,
    issueKeyHash: 'b'.repeat(64),
    requestFingerprint: 'c'.repeat(64),
    issueRequestId: 'issue',
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + 300000),
    state: 'CONSUMED',
    decisionFence: 1,
    consumedAt: respondedAt,
    receiptId: oid(81),
    revokedAt: null,
    revokedBy: null,
  });
  c.requestFingerprint = checkpointIssueFingerprint(c);
  const r = visualReceiptRecord.parse({
    _id: oid(81),
    userId: oid(1),
    conceptId: oid(2),
    section: 'VISUALIZE',
    schemaVersion: 2,
    producerVersion: 1,
    ...checkpointPolicy,
    definitionId: d._id,
    definitionFingerprint: d.definitionFingerprint,
    visualizationId: d.visualizationId,
    visualizationRevision: d.visualizationRevision,
    checkpointId: d.checkpointId,
    checkpointVersion: d.checkpointVersion,
    conceptRevision: d.conceptRevision,
    sectionRevision: d.visualizationRevision,
    challengeId: c._id,
    origin: 'CHECKPOINT_SERVICE',
    purpose: 'ACTIVITY_ONLY',
    outcome: 'CORRECT',
    respondedAt,
    ackKeyHash: 'e'.repeat(64),
    requestFingerprint: checkpointResponseFingerprint(c, 'yes'),
    ackRequestId: 'response',
  });
  t.mock.method(
    mongoQualification,
    'actions',
    async (_owner: string, _concept: string, section: string) =>
      section === 'VISUALIZE' ? [{ challenge: c, receipt: r }] : [],
  );
  const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db');
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: {
      collection(name: string) {
        assert.equal(name, 'practiceAttempts');
        return {
          find() {
            return {
              limit() {
                return {
                  async toArray() {
                    return [];
                  },
                };
              },
            };
          },
        };
      },
    },
  });
  try {
    const scope = { ...f.makeScope(), checkpoint: d };
    assert.equal(
      (await mongoCompletionStore.sources(scope, {}, false)).actions.find(
        (a) => a.section === 'VISUALIZE',
      )!.status,
      'QUALIFIED',
    );
    r.definitionId = oid(99);
    await assert.rejects(mongoCompletionStore.sources(scope, {}, false), {
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  } finally {
    if (descriptor)
      Object.defineProperty(mongoose.connection, 'db', descriptor);
    else Reflect.deleteProperty(mongoose.connection, 'db');
  }
});
test('native postcommit activity proof bounds every command by remaining time with primary-majority reads', async () => {
  const f = fixture(),
    descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'db'),
    observed: { name: string; opts: Record<string, unknown> }[] = [];
  const hierarchy = {
    conceptId: oid(2),
    technologyId: oid(20),
    learningPathId: oid(21),
    moduleId: oid(22),
    topicId: oid(23),
  };
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: {
      collection(name: string) {
        return {
          aggregate(_pipeline: unknown, opts: Record<string, unknown>) {
            observed.push({ name, opts });
            assert(['concepts', 'practiceAttempts'].includes(name));
            return {
              async toArray() {
                return name === 'concepts'
                  ? [hierarchy]
                  : [
                      {
                        invalid: 0,
                        attemptCount: 1,
                        startedAt: f.at,
                        lastActivityAt: f.at,
                      },
                    ];
              },
            };
          },
          find(_filter: unknown, opts: Record<string, unknown>) {
            assert.equal(name, 'studentProgress');
            observed.push({ name, opts });
            return {
              limit(n: number) {
                assert.equal(n, 2);
                return {
                  async toArray() {
                    return [f.state.summary];
                  },
                };
              },
            };
          },
        };
      },
    },
  });
  let ms = 1750;
  try {
    const baseline = await mongoCompletionStore.progress(owner, concept, {
      session: {} as ClientSession,
      majority: true,
      get timeoutMS() {
        return ms--;
      },
    });
    assert.equal(baseline.stats.attemptCount, 1);
    assert.equal(observed.length, 3);
    for (const { opts } of observed) {
      assert(Number(opts.timeoutMS) > 0 && Number(opts.timeoutMS) <= 1750);
      assert.deepEqual(opts.readConcern, { level: 'majority' });
      assert.equal(opts.readPreference, 'primary');
    }
    assert(
      Number(observed[2]!.opts.timeoutMS) < Number(observed[0]!.opts.timeoutMS),
    );
    assert.equal(mongoose.connection.readyState, 0);
  } finally {
    if (descriptor)
      Object.defineProperty(mongoose.connection, 'db', descriptor);
    else Reflect.deleteProperty(mongoose.connection, 'db');
  }
});
