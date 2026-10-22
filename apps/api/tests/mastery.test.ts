import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../src/common/errors/app-error.js';
import {
  createAccessTokens,
  type AuthContext,
} from '../src/modules/auth/access-token.service.js';
import {
  conceptCompletionPolicy,
  completionPolicyFingerprint,
} from '../src/modules/concepts/concept.model.js';
import { attemptRecord } from '../src/modules/practice/practice-attempt.model.js';
import { completionAssessmentRecord } from '../src/modules/practice/practice-assessment.model.js';
import type { GradingRead } from '../src/modules/practice/practice-rubric.repository.js';
import {
  createMasteryService,
  type MasteryStore,
} from '../src/modules/progress/mastery.service.js';
import type {
  CompletionScope,
  CompletionSources,
} from '../src/modules/progress/completion.repository.js';

const oid = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const profile = {
  id: 'F039_DEFAULT_MASTERY',
  version: 1,
  improvingMinimum: 60,
  strongMinimum: 80,
};
const owner = oid(1).toHexString(),
  concept = oid(2).toHexString();
function fixture(score: 0 | 100 = 100) {
  const date = new Date(Date.now() - 1000),
    hash = 'a'.repeat(64);
  const draft = {
    policyId: oid(8).toHexString(),
    version: 1,
    conceptId: concept,
    conceptRevision: hash,
    sourceEpoch: 'b'.repeat(64),
    requiredSections: ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const,
    minimumScore: 70 as const,
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
    authoredAt: date,
    state: 'APPROVED' as const,
    approvedBy: oid(7).toHexString(),
    approvedAt: date,
    approvedFingerprint: hash,
    revokedBy: null,
    revokedAt: null,
  };
  const fingerprint = completionPolicyFingerprint({
    ...draft,
    requiredSections: [...draft.requiredSections],
  });
  const policy = conceptCompletionPolicy.parse({
    ...draft,
    fingerprint,
    approvedFingerprint: fingerprint,
  });
  const attempt = attemptRecord.parse({
    _id: oid(10),
    userId: oid(1),
    conceptId: oid(2),
    questionId: oid(3),
    type: 'OUTPUT',
    questionRevision: hash,
    contentFingerprint: hash,
    attemptNumber: 1,
    studentAnswer: 'private-student-sentinel',
    submittedAt: date,
    result: 'SUBMITTED',
    score: null,
    idempotencyKeyHash: 'c'.repeat(64),
    requestFingerprint: 'd'.repeat(64),
    schemaVersion: 1,
  });
  const assessment = completionAssessmentRecord.parse({
    _id: oid(11),
    userId: oid(1),
    attemptId: attempt._id,
    conceptId: oid(2),
    questionId: oid(3),
    type: 'OUTPUT',
    questionRevision: hash,
    contentFingerprint: hash,
    attemptRequestFingerprint: attempt.requestFingerprint,
    rubricId: oid(4),
    rubricVersion: 1,
    rubricDefinitionFingerprint: hash,
    graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
    graderVersion: 1,
    purpose: 'COMPLETION_INPUT',
    outcome: score === 100 ? 'CORRECT' : 'INCORRECT',
    score,
    refusalCode: null,
    evaluatedAt: date,
    requestedBy: oid(1),
    authorityId: oid(30),
    reviewerId: oid(7),
    approvalAuditId: oid(31),
    authorizationFence: 1,
    requestFingerprint: 'e'.repeat(64),
    schemaVersion: 2,
    policyId: oid(8),
    policyVersion: 1,
    policyFingerprint: fingerprint,
    sourceEpoch: policy.sourceEpoch,
    submissionProvenance: 'F036_FIRST_SUBMISSION_ATOMIC_V1',
    attemptNumber: 1,
  });
  const actor: AuthContext = {
    sub: owner,
    sid: oid(50).toHexString(),
    role: 'STUDENT',
    plan: 'FREE',
  };
  const state = {
    now: 0,
    live: true,
    eligible: true,
    published: true,
    approved: true,
    ready: true,
    phase: 'snapshot',
    scopeState: 'CURRENT' as CompletionScope['state'],
    status: (score === 100
      ? 'QUALIFIED'
      : 'BELOW_THRESHOLD') as CompletionSources['practiceStatus'],
    attempt: attempt as CompletionSources['attempt'],
    assessment: assessment as CompletionSources['assessment'],
    bodies: 0,
    reentries: 1,
    verifies: 0,
    closed: 0,
    unknown: false,
    closeFails: false,
    options: {} as Record<string, unknown>,
    events: [] as string[],
    timeouts: [] as number[],
    hook: (() => {}) as (stage: string, read?: GradingRead) => void,
  };
  const observe = (stage: string, read?: GradingRead) => {
    state.events.push(stage);
    state.hook(stage, read);
    if (read?.majority) {
      assert.equal(read.majority, true);
      state.timeouts.push(read.timeoutMS!);
    }
  };
  const origin = {
    assert() {
      if (!state.live) throw new Error('private-origin-sentinel');
    },
    async current(read: GradingRead, fence: boolean) {
      assert.equal(fence, false);
      observe('origin', read);
      if (!state.approved) throw new Error('private-approval-sentinel');
      return policy;
    },
    async ready() {},
  };
  const store: MasteryStore = {
    async ready(ms) {
      observe('ready');
      assert(ms > 0);
      if (!state.ready) throw new Error('private-index-sentinel');
    },
    async session() {
      observe('session');
      return {
        async withTransaction(
          fn: () => Promise<void>,
          options: Record<string, unknown>,
        ) {
          state.options = options;
          for (let i = 0; i < state.reentries; i++) {
            state.bodies++;
            await fn();
          }
          if (state.unknown)
            throw {
              errorLabels: ['UnknownTransactionCommitResult'],
              message: 'private-commit-sentinel',
            };
          state.phase = 'proof';
          observe('commit');
        },
        async endSession() {
          state.closed++;
          observe('cleanup');
          if (state.closeFails) throw new Error('private-cleanup-sentinel');
        },
      } as unknown as ClientSession;
    },
    async scope(who, requested, read, fence) {
      assert.equal(who, actor.sub);
      assert.equal(requested, concept);
      assert.equal(fence, false);
      observe('scope', read);
      if (!state.eligible)
        throw new AppError(403, 'AUTH_FORBIDDEN', 'private-account-sentinel');
      if (!state.published)
        throw new AppError(
          404,
          'CONCEPT_NOT_FOUND',
          'private-ancestry-sentinel',
        );
      return {
        owner: who,
        conceptId: requested,
        conceptRevision: policy.conceptRevision,
        policy,
        state: state.scopeState,
        origin,
        checkpoint: null,
        visualization: null,
      };
    },
    async sources(scope, read, fence) {
      assert.equal(scope.owner, actor.sub);
      assert.equal(fence, false);
      observe('sources', read);
      return {
        actions: [],
        attempt: state.attempt,
        assessment: state.assessment,
        practiceStatus: state.status,
      };
    },
  };
  const tokens = {
    async verify(token: string) {
      assert.equal(token, 'opaque-offline-token');
      state.verifies++;
      observe('token');
      return { ...actor };
    },
  };
  const command = { accessToken: 'opaque-offline-token', conceptId: concept };
  const service = createMasteryService(
    tokens,
    { APP_ENV: 'LOCAL' },
    profile,
    store,
    () => state.now,
  );
  return {
    service,
    command,
    state,
    store,
    tokens,
    actor,
    policy,
    attempt,
    assessment,
    origin,
  };
}
const rejected = (
  work: Promise<unknown>,
  status = 503,
  code = 'DEPENDENCY_UNAVAILABLE',
) =>
  assert.rejects(work, (e: unknown) => {
    assert(e instanceof AppError);
    assert.equal(e.statusCode, status);
    assert.equal(e.code, code);
    assert.doesNotMatch(
      JSON.stringify({ message: e.message, details: e.details }),
      /private-|opaque-offline-token/,
    );
    return true;
  });

test('genuine score 100 yields exact two-field STRONG without requiring section completion', async () => {
  const f = fixture();
  assert.deepEqual(await f.service.classify(f.command), {
    classification: 'STRONG',
    code: 'NONE',
  });
  assert.equal(f.state.closed, 1);
  assert.equal(f.state.verifies, 3);
  assert.equal(f.state.bodies, 1);
  assert.deepEqual(f.state.options, {
    timeoutMS: 8000,
    maxCommitTimeMS: 2000,
    readPreference: 'primary',
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority', j: true },
  });
  assert.equal(f.state.events.filter((e) => e === 'sources').length, 2);
});
test('genuine score zero stays WEAK rather than missing or completion eligible', async () => {
  const f = fixture(0);
  assert.deepEqual(await f.service.classify(f.command), {
    classification: 'WEAK',
    code: 'NONE',
  });
});
test('missing and unqualified evidence are UNCLASSIFIED rather than fabricated zero', async () => {
  for (const status of ['MISSING', 'UNQUALIFIED'] as const) {
    const f = fixture();
    f.state.assessment = f.state.attempt = null;
    f.state.status = status;
    assert.deepEqual(await f.service.classify(f.command), {
      classification: 'UNCLASSIFIED',
      code: 'SCORE_MISSING',
    });
  }
});
test('known stale and revoked sources never yield a label', async () => {
  for (const state of ['STALE', 'REVOKED'] as const) {
    const f = fixture();
    f.state.scopeState = state;
    assert.deepEqual(await f.service.classify(f.command), {
      classification: 'UNCLASSIFIED',
      code: `${state}_ASSESSMENT`,
    });
  }
  const f = fixture();
  f.state.status = 'STALE';
  f.state.assessment = f.state.attempt = null;
  assert.deepEqual(await f.service.classify(f.command), {
    classification: 'UNCLASSIFIED',
    code: 'STALE_ASSESSMENT',
  });
});
test('strict command rejects caller scores, identities, policies, selectors and accessors', async () => {
  for (const extra of [
    { score: 100 },
    { userId: owner },
    { assessmentId: oid(11).toHexString() },
    { approved: true },
    { policy: profile },
  ]) {
    const f = fixture();
    await rejected(
      f.service.classify({ ...f.command, ...extra }),
      400,
      'VALIDATION_ERROR',
    );
    assert.equal(f.state.verifies, 0);
  }
  const f = fixture();
  let called = false;
  const input = Object.defineProperty({}, 'accessToken', {
    enumerable: true,
    get() {
      called = true;
      return 'secret';
    },
  });
  await rejected(f.service.classify(input), 400, 'VALIDATION_ERROR');
  assert.equal(called, false);
});
test('malformed Concept and missing/oversized tokens refuse before source access', async () => {
  for (const input of [
    { accessToken: '', conceptId: concept },
    { accessToken: 'x'.repeat(4097), conceptId: concept },
    { accessToken: 'x', conceptId: concept.toUpperCase() + '\n' },
    null,
  ]) {
    const f = fixture();
    await rejected(f.service.classify(input), 400, 'VALIDATION_ERROR');
    assert.equal(f.state.events.length, 0);
  }
});
test('LOCAL restriction fails closed without verifying a token or touching storage', async () => {
  const f = fixture();
  const s = createMasteryService(
    f.tokens,
    { APP_ENV: 'PRODUCTION' },
    profile,
    f.store,
  );
  await rejected(s.classify(f.command), 404, 'ROUTE_NOT_FOUND');
  assert.equal(f.state.events.length, 0);
});
test('current Student role, identity, status and publication failures are sanitized', async () => {
  const f = fixture();
  f.actor.role = 'ADMIN';
  await rejected(f.service.classify(f.command), 403, 'AUTH_FORBIDDEN');
  for (const field of ['eligible', 'published'] as const) {
    const g = fixture();
    g.state[field] = false;
    await rejected(
      g.service.classify(g.command),
      field === 'eligible' ? 403 : 404,
      field === 'eligible' ? 'AUTH_FORBIDDEN' : 'CONCEPT_NOT_FOUND',
    );
    assert.equal(g.state.closed, 1);
  }
});
test('actor is reauthenticated and current eligibility is rechecked during majority proof', async () => {
  for (const mutation of ['actor', 'status', 'publication'] as const) {
    const f = fixture();
    f.state.hook = (stage) => {
      if (stage === 'commit') {
        if (mutation === 'actor') f.actor.sub = oid(99).toHexString();
        else if (mutation === 'status') f.state.eligible = false;
        else f.state.published = false;
      }
    };
    await rejected(
      f.service.classify(f.command),
      mutation === 'publication' ? 404 : 403,
      mutation === 'publication' ? 'CONCEPT_NOT_FOUND' : 'AUTH_FORBIDDEN',
    );
  }
});
test('origin loss or unverifiable independent approval refuses even after successful snapshot', async () => {
  for (const stage of ['ready', 'commit', 'cleanup']) {
    const f = fixture();
    f.state.hook = (at) => {
      if (at === stage) f.state.live = false;
    };
    await rejected(f.service.classify(f.command));
  }
  const f = fixture();
  f.state.approved = false;
  await rejected(f.service.classify(f.command));
});
test('independently reviewed policy schema rejects self-approval and unsupported threshold', async () => {
  for (const value of ['self', 'threshold'] as const) {
    const f = fixture();
    if (value === 'self') f.policy.approvedBy = f.policy.authoredBy;
    else (f.policy as unknown as Record<string, unknown>).minimumScore = 60;
    await rejected(f.service.classify(f.command));
  }
});
test('all ownership, original-attempt and request identities must bind exactly', async () => {
  for (const override of [
    { userId: oid(99) },
    { conceptId: oid(99) },
    { questionId: oid(99) },
    { attemptNumber: 2 },
    { type: 'CODING' },
    { questionRevision: 'f'.repeat(64) },
    { contentFingerprint: 'f'.repeat(64) },
    { submittedAt: new Date(0) },
  ]) {
    const f = fixture();
    f.state.attempt = { ...f.attempt, ...override } as typeof f.attempt;
    await rejected(f.service.classify(f.command));
  }
  for (const override of [
    { userId: oid(99) },
    { attemptId: oid(99) },
    { conceptId: oid(99) },
    { questionId: oid(99) },
    { attemptRequestFingerprint: 'f'.repeat(64) },
    { requestedBy: oid(99) },
  ]) {
    const f = fixture();
    f.state.assessment = { ...f.assessment, ...override };
    await rejected(f.service.classify(f.command));
  }
});
test('rubric, policy, epoch and revision mismatch cannot yield a score label', async () => {
  for (const override of [
    { rubricId: oid(99) },
    { rubricVersion: 2 },
    { rubricDefinitionFingerprint: 'f'.repeat(64) },
    { policyId: oid(99) },
    { policyVersion: 2 },
    { policyFingerprint: 'f'.repeat(64) },
    { sourceEpoch: 'f'.repeat(64) },
    { questionRevision: 'f'.repeat(64) },
    { contentFingerprint: 'f'.repeat(64) },
  ]) {
    const f = fixture();
    f.state.assessment = { ...f.assessment, ...override };
    await rejected(f.service.classify(f.command));
  }
});
test('diagnostic, historical, unsupported, malformed and invented intermediate scores refuse', async () => {
  for (const override of [
    { purpose: 'DIAGNOSTIC' },
    { schemaVersion: 1 },
    { graderId: 'OUTPUT_EXACT_TEXT' },
    { attemptNumber: 2 },
    { submissionProvenance: 'HISTORICAL' },
    { score: 70 },
    { score: null },
    { score: NaN },
    { score: Infinity },
    { score: '100' },
    { expectedAnswer: 'private-solution' },
  ]) {
    const f = fixture();
    f.state.assessment = {
      ...f.assessment,
      ...override,
    } as typeof f.assessment;
    await rejected(f.service.classify(f.command));
  }
});
test('missing or contradictory owned records fail closed without trying another source', async () => {
  for (const part of ['attempt', 'assessment'] as const) {
    const f = fixture();
    f.state[part] = null;
    await rejected(f.service.classify(f.command));
    assert.equal(f.state.events.filter((e) => e === 'sources').length, 1);
  }
});
test('fresh majority proof identity loss and score changes cannot reuse snapshot success', async () => {
  for (const change of ['id', 'score', 'missing'] as const) {
    const f = fixture();
    f.state.hook = (stage) => {
      if (stage === 'commit') {
        if (change === 'missing') {
          f.state.attempt = f.state.assessment = null;
          f.state.status = 'MISSING';
        } else if (change === 'score') {
          f.state.assessment = {
            ...f.assessment,
            score: 0,
            outcome: 'INCORRECT',
          };
          f.state.status = 'BELOW_THRESHOLD';
        } else f.state.assessment = { ...f.assessment, _id: oid(99) };
      }
    };
    await rejected(f.service.classify(f.command));
  }
});
test('database/index failure, uncertain transaction and cleanup failure are not missing evidence', async () => {
  for (const field of ['ready', 'unknown', 'closeFails'] as const) {
    const f = fixture();
    f.state[field] = field !== 'ready';
    await rejected(f.service.classify(f.command));
  }
});
test('three-body callback limit and two-second reserve remain unchanged', async () => {
  const f = fixture();
  f.state.reentries = 4;
  await rejected(f.service.classify(f.command));
  assert.equal(f.state.bodies, 4);
  assert.equal(f.state.events.filter((e) => e === 'scope').length, 3);
  const g = fixture();
  g.state.hook = (stage) => {
    if (stage === 'ready') g.state.now = 8000;
  };
  await rejected(g.service.classify(g.command));
  assert.equal(g.state.bodies, 0);
});
test('remaining timeout is recomputed at successive majority proof operations', async () => {
  const f = fixture();
  f.state.hook = (_stage, read) => {
    if (read?.majority) f.state.now += 100;
  };
  await f.service.classify(f.command);
  assert(f.state.timeouts.length >= 3);
  assert(
    f.state.timeouts.every(
      (v, i, all) => v > 0 && (i === 0 || v < all[i - 1]!),
    ),
  );
});
test('deadline exhaustion before proof, between reads and after cleanup refuses success', async () => {
  for (const stage of ['commit', 'sources', 'cleanup']) {
    const f = fixture();
    f.state.hook = (at, read) => {
      if (at === stage && (stage !== 'sources' || read?.majority))
        f.state.now = 10000;
    };
    await rejected(f.service.classify(f.command));
    assert.equal(f.state.closed, 1);
  }
});
test('profile is explicit, strict, copied and not inferred from completion threshold', async () => {
  const f = fixture(0);
  for (const bad of [
    null,
    undefined,
    { ...profile, strongMinimum: 60 },
    { ...profile, improvingMinimum: '60' },
    { ...profile, approved: true },
  ])
    assert.throws(
      () => createMasteryService(f.tokens, { APP_ENV: 'LOCAL' }, bad, f.store),
      AppError,
    );
  const supplied = { ...profile };
  const s = createMasteryService(
    f.tokens,
    { APP_ENV: 'LOCAL' },
    supplied,
    f.store,
    () => f.state.now,
  );
  supplied.improvingMinimum = 0;
  assert.deepEqual(await s.classify(f.command), {
    classification: 'WEAK',
    code: 'NONE',
  });
});
test('repeated and concurrent reads expose no private data and never mutate records', async () => {
  const f = fixture();
  const before = JSON.stringify([f.attempt, f.assessment, f.policy]);
  const results = await Promise.all(
    Array.from({ length: 3 }, () => f.service.classify(f.command)),
  );
  for (const r of results) {
    assert.deepEqual(Object.keys(r).sort(), ['classification', 'code']);
    assert.doesNotMatch(
      JSON.stringify(r),
      /private|score|conceptId|rubric|answer|token|fingerprint/,
    );
  }
  assert.equal(JSON.stringify([f.attempt, f.assessment, f.policy]), before);
  assert.equal(f.state.closed, 3);
});
test('genuine signed access tokens are verified with existing Auth algorithms and expiry', async () => {
  const f = fixture();
  let now = new Date();
  const tokens = createAccessTokens(
    {
      ACCESS_TOKEN_SECRET: randomBytes(32).toString('base64'),
      ACCESS_TOKEN_ISSUER: 'f039-test',
      ACCESS_TOKEN_AUDIENCE: 'f039-test',
    },
    () => now,
  );
  const signed = await tokens.sign(f.actor);
  const s = createMasteryService(
    tokens,
    { APP_ENV: 'LOCAL' },
    profile,
    f.store,
    () => f.state.now,
  );
  assert.deepEqual(
    await s.classify({ accessToken: signed, conceptId: concept }),
    { classification: 'STRONG', code: 'NONE' },
  );
  await rejected(
    s.classify({ accessToken: signed + 'invalid', conceptId: concept }),
    401,
    'AUTH_ACCESS_TOKEN_INVALID',
  );
  now = new Date(now.getTime() + 901000);
  await rejected(
    s.classify({ accessToken: signed, conceptId: concept }),
    401,
    'AUTH_ACCESS_TOKEN_EXPIRED',
  );
});
test('implementation is internal read-only with no grading, persistence or route invocation', () => {
  const source = readFileSync(
    new URL('../src/modules/progress/mastery.service.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /console\.|\.sign\(|\.save\(|\.insert\(|\.update\(|\.record\(|\.complete\(|\.consume\(|\.listen\(|\.get\('/,
  );
  assert.match(source, /store\.sources\(scope, read, false\)/);
});

test('same classification cannot hide replacement of the immutable original attempt', async () => {
  const f = fixture();
  f.state.hook = (stage) => {
    if (stage === 'commit') {
      f.state.attempt = { ...f.attempt, _id: oid(98) };
      f.state.assessment = { ...f.assessment, attemptId: oid(98) };
    }
  };
  await rejected(f.service.classify(f.command));
});

test('snapshot owner/Concept drift and missing approved policy are not trusted context', async () => {
  for (const override of [
    { owner: oid(99).toHexString() },
    { conceptId: oid(99).toHexString() },
    { policy: null },
    { state: 'MISSING' as const },
  ]) {
    const f = fixture();
    const original = f.store.scope;
    f.store.scope = async (...args) => ({
      ...(await original(...args)),
      ...override,
    });
    await rejected(f.service.classify(f.command));
  }
});

test('prepared integration has no automatic invocation, provisioning or fabricated signing', () => {
  const source = readFileSync(
    new URL('./mastery.integration.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /export function runMasteryIntegration/);
  assert.match(source, /masteryIntegrationIndexes = fixtureIndexes/);
  assert.match(source, /initialization\.onLoss/);
  assert.doesNotMatch(
    source,
    /\.sign\(|createIndex\(|dropIndex\(|createCollection\(|console\.|process\.env\[/,
  );
});
