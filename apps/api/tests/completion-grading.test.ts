import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import {
  createCompletionGrading,
  type CompletionAssessmentStore,
  type QualificationAuthority,
} from '../src/modules/practice/completion-grading.service.js';
import {
  createPracticeAttemptRepository,
  type AttemptStore,
} from '../src/modules/practice/practice-attempt.repository.js';
import {
  completionAssessmentRecord,
  type CompletionAssessmentRecord,
} from '../src/modules/practice/practice-assessment.model.js';
import { type AttemptRecord } from '../src/modules/practice/practice-attempt.model.js';
import {
  definitionFingerprint,
  type RubricDefinition,
  type RubricAuthority,
} from '../src/modules/practice/practice-rubric.model.js';
import type { RubricStore } from '../src/modules/practice/practice-rubric.repository.js';
import {
  completionPolicyFingerprint,
  type ConceptCompletionPolicy,
} from '../src/modules/concepts/concept.model.js';
const oid = () => new Types.ObjectId();
function fixture() {
  const user = oid(),
    question = oid(),
    concept = oid(),
    author = oid(),
    reviewer = oid(),
    rubricId = oid();
  const state = {
    origin: true,
    active: true,
    readyFault: false,
    policyValid: true,
    revoked: false,
    denied: false,
    proofFault: false,
    corruptProof: false,
    summaryFault: false,
    unknown: false,
    assessmentFault: false,
    attempts: [] as AttemptRecord[],
    grades: [] as CompletionAssessmentRecord[],
    pendingAttempts: [] as AttemptRecord[],
    pendingGrades: [] as CompletionAssessmentRecord[],
    events: [] as string[],
    summaries: 0,
    options: {} as Record<string, unknown>,
  };
  const def = {
    _id: oid(),
    rubricId,
    version: 1,
    questionId: question,
    conceptId: concept,
    type: 'OUTPUT' as const,
    questionRevision: 'a'.repeat(64),
    contentFingerprint: 'b'.repeat(64),
    answerForm: 'TEXT' as const,
    comparison: 'EXACT_TEXT' as const,
    normalization: 'NONE' as const,
    expectedAnswer: ' 1\n',
    authorId: author,
    createdAt: new Date('2026-01-01'),
    schemaVersion: 1 as const,
  };
  const d: RubricDefinition = {
    ...def,
    definitionFingerprint: definitionFingerprint({
      ...def,
      definitionFingerprint: '',
    }),
  };
  const a: RubricAuthority = {
    _id: oid(),
    rubricId,
    version: 1,
    definitionId: d._id,
    definitionFingerprint: d.definitionFingerprint,
    authorId: author,
    reviewerId: reviewer,
    approvedAt: new Date('2026-01-02'),
    approvalAuditId: oid(),
    state: 'APPROVED',
    decisionFence: 1,
    revokedBy: null,
    revokedAt: null,
    revocationAuditId: null,
    schemaVersion: 1,
  };
  const draft = {
    policyId: oid().toHexString(),
    version: 1,
    conceptId: concept.toHexString(),
    conceptRevision: 'c'.repeat(64),
    sourceEpoch: 'd'.repeat(64),
    requiredSections: [
      'READ',
      'VISUALIZE',
      'EXAMPLE',
      'PRACTICE',
    ] as ConceptCompletionPolicy['requiredSections'],
    minimumScore: 70 as const,
    questionId: question.toHexString(),
    questionRevision: d.questionRevision,
    contentFingerprint: d.contentFingerprint,
    rubricId: rubricId.toHexString(),
    rubricVersion: 1,
    rubricDefinitionFingerprint: d.definitionFingerprint,
    checkpointDefinitionId: oid().toHexString(),
    checkpointFingerprint: 'e'.repeat(64),
    visualizationRevision: 'f'.repeat(64),
    authoredBy: author.toHexString(),
    authoredAt: new Date('2026-01-01'),
    state: 'APPROVED' as const,
    approvedBy: reviewer.toHexString(),
    approvedAt: new Date('2026-01-02'),
    revokedBy: null,
    revokedAt: null,
  };
  const p: ConceptCompletionPolicy = {
    ...draft,
    fingerprint: completionPolicyFingerprint({
      ...draft,
      approvedFingerprint: null,
    }),
    approvedFingerprint: null,
  };
  p.approvedFingerprint = p.fingerprint;
  const origin: QualificationAuthority = {
    assert() {
      if (!state.active) throw Error('origin unavailable');
    },
    async ready() {
      if (state.readyFault) throw Error('index readiness unavailable');
    },
    async current(_read, fence) {
      if (!state.policyValid) throw Error('policy');
      if (fence) state.events.push('policy-fence');
      return p;
    },
  };
  const rubrics = {
    async definition() {
      return d;
    },
    async authority() {
      return state.revoked
        ? {
            ...a,
            state: 'REVOKED',
            revokedBy: author,
            revokedAt: new Date(),
            revocationAuditId: oid(),
          }
        : a;
    },
    async actor() {
      if (state.denied) throw Error('actor');
    },
    async auditProof() {
      state.events.push('audit');
    },
    async fence(value: RubricAuthority) {
      state.events.push('rubric-fence');
      a.decisionFence = value.decisionFence + 1;
      return { ...a };
    },
  } as unknown as RubricStore;
  const assessments: CompletionAssessmentStore = {
    async ready() {},
    async insert(row, read) {
      assert(read.session?.inTransaction());
      if (state.assessmentFault) throw Error('assessment');
      state.pendingGrades.push(completionAssessmentRecord.parse(row));
      state.events.push('assessment');
    },
    async find(attempt, read) {
      if (read.majority && state.proofFault) return null;
      const found =
        [...state.grades, ...state.pendingGrades].find((r) =>
          r.attemptId.equals(attempt._id),
        ) ?? null;
      return found && read.majority && state.corruptProof
        ? completionAssessmentRecord.parse({
            ...found,
            outcome: 'CORRECT',
            score: 100,
          })
        : found;
    },
  };
  let inTransaction = false,
    gate = Promise.resolve();
  const session = {
    inTransaction: () => inTransaction,
    async withTransaction(
      work: () => Promise<void>,
      opts: Record<string, unknown>,
    ) {
      const prior = gate;
      let release = () => {};
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await prior;
      state.options = opts;
      inTransaction = true;
      state.pendingAttempts = [];
      state.pendingGrades = [];
      try {
        await work();
        state.attempts.push(...state.pendingAttempts);
        state.grades.push(...state.pendingGrades);
        state.events.push('commit');
        if (state.unknown)
          throw { errorLabels: ['UnknownTransactionCommitResult'] };
      } finally {
        inTransaction = false;
        state.pendingAttempts = [];
        state.pendingGrades = [];
        release();
      }
    },
    async endSession() {
      state.events.push('closed');
    },
  } as unknown as ClientSession;
  const content = {
    data: {
      id: question.toHexString(),
      conceptId: concept.toHexString(),
      type: 'OUTPUT' as const,
      answer: 'PRIVATE ANSWER',
      explanation: null,
    },
    questionRevision: d.questionRevision,
    contentFingerprint: d.contentFingerprint,
  };
  const store = {
    async ready() {},
    async session() {
      return session;
    },
    async qualified() {
      return content;
    },
    async byKey(_owner: Types.ObjectId, key: string) {
      return state.attempts.find((r) => r.idempotencyKeyHash === key) ?? null;
    },
    async last() {
      return state.attempts.length;
    },
    async progressBefore() {
      return {};
    },
    async progressAfter() {
      if (state.summaryFault) throw Error('summary');
      state.events.push('activity');
    },
    async insert(row: AttemptRecord) {
      state.pendingAttempts.push(row);
      state.events.push('attempt');
    },
    async proof(id: Types.ObjectId) {
      state.events.push('owned-proof');
      return state.attempts.find((r) => r._id.equals(id));
    },
  } as unknown as AttemptStore;
  const grading = createCompletionGrading(
    () => (state.origin ? origin : null),
    rubrics,
    assessments,
  );
  const repository = createPracticeAttemptRepository(store, () => 0, grading);
  const input = {
    conceptId: concept.toHexString(),
    questionId: question.toHexString(),
    questionRevision: d.questionRevision,
    studentAnswer: d.expectedAnswer,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
  };
  const submit = (change = {}) =>
    repository.submit(user.toHexString(), { ...input, ...change });
  return { state, submit, input, p, d, a, grading, origin, session };
}
test('first submission commits immutable attempt, qualifying grade and ordinary activity before answer return', async () => {
  const f = fixture(),
    result = await f.submit();
  assert.equal(result.data.answer, 'PRIVATE ANSWER');
  assert.equal(f.state.attempts.length, 1);
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.attempts[0]!.score, null);
  assert.equal(f.state.attempts[0]!.result, 'SUBMITTED');
  assert.equal(f.state.grades[0]!.score, 100);
  assert.equal(f.state.grades[0]!.purpose, 'COMPLETION_INPUT');
  assert(
    f.state.events.indexOf('attempt') < f.state.events.indexOf('assessment'),
  );
  assert(
    f.state.events.indexOf('assessment') < f.state.events.indexOf('activity'),
  );
  assert(
    f.state.events.indexOf('commit') < f.state.events.indexOf('owned-proof'),
  );
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.equal('score' in result.data, false);
  assert.equal('studentAnswer' in f.state.grades[0]!, false);
});
test('genuine incorrect first answer scores zero; reveal-assisted later answer never replaces it', async () => {
  const f = fixture();
  await f.submit({ studentAnswer: '1' });
  assert.equal(f.state.grades[0]!.score, 0);
  await f.submit({ idempotencyKey: '22222222-2222-4222-8222-222222222222' });
  assert.equal(f.state.attempts.length, 2);
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.grades[0]!.score, 0);
});
test('exact idempotent replay returns original receipt without new grading or activity', async () => {
  const f = fixture(),
    first = await f.submit(),
    second = await f.submit();
  assert.deepEqual(first, second);
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.events.filter((e) => e === 'activity').length, 1);
});
test('changed same-key request conflicts without extra records or answer leakage', async () => {
  const f = fixture();
  await f.submit();
  await assert.rejects(
    f.submit({ studentAnswer: 'changed' }),
    (e) => !JSON.stringify(e).includes('PRIVATE ANSWER'),
  );
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.attempts.length, 1);
});
test('submission before sealing or after lifecycle uncertainty rolls back', async () => {
  const f = fixture();
  f.state.active = false;
  await assert.rejects(f.submit());
  assert.equal(f.state.attempts.length, 0);
  assert.equal(f.state.grades.length, 0);
});
test('historical/unknown origin remains ordinary ungraded F036 activity', async () => {
  const f = fixture();
  f.state.origin = false;
  await f.submit();
  assert.equal(f.state.grades.length, 0);
  f.state.origin = true;
  await assert.rejects(f.submit()); // no retroactive grade on replay.
  assert.equal(f.state.grades.length, 0);
});
test('assessment insertion and progress failure roll back the whole submission', async () => {
  for (const field of ['summaryFault', 'assessmentFault'] as const) {
    const f = fixture();
    f.state[field] = true;
    await assert.rejects(f.submit());
    assert.equal(f.state.attempts.length, 0);
    assert.equal(f.state.grades.length, 0);
  }
});
test('uncertain commit returns no answer, retaining durable original records for exact retry', async () => {
  const f = fixture();
  f.state.unknown = true;
  await assert.rejects(f.submit());
  assert.equal(f.state.attempts.length, 1);
  assert.equal(f.state.grades.length, 1);
  f.state.unknown = false;
  await f.submit();
  assert.equal(f.state.grades.length, 1);
});
test('missing majority assessment proof suppresses the answer after durable commit', async () => {
  const f = fixture();
  f.state.proofFault = true;
  await assert.rejects(f.submit());
  assert.equal(f.state.attempts.length, 1);
  assert.equal(f.state.grades.length, 1);
});
test('lost origin cannot be reconstructed from an existing qualifying assessment', async () => {
  const f = fixture();
  await f.submit();
  f.state.origin = false;
  await assert.rejects(f.submit());
  assert.equal(f.state.grades.length, 1);
});
test('revoked rubric, inactive actors and invalid policy cannot produce a qualifying attempt', async () => {
  for (const field of ['revoked', 'denied'] as const) {
    const f = fixture();
    f.state[field] = true;
    await assert.rejects(f.submit());
    assert.equal(f.state.attempts.length, 0);
  }
  const f = fixture();
  f.state.policyValid = false;
  await assert.rejects(f.submit());
  assert.equal(f.state.attempts.length, 0);
});
test('question/revision/private fingerprint and policy bindings must match exactly', async () => {
  for (const field of [
    'questionRevision',
    'contentFingerprint',
    'rubricDefinitionFingerprint',
    'questionId',
    'conceptId',
  ] as const) {
    const f = fixture();
    f.p[field] = '0'.repeat(field.endsWith('Id') ? 24 : 64);
    await assert.rejects(f.submit());
    assert.equal(f.state.grades.length, 0);
  }
});
test('invalid OUTPUT text refuses without making up a score or consuming the first submission', async () => {
  const f = fixture();
  await assert.rejects(f.submit({ studentAnswer: '\ud800' }));
  assert.equal(f.state.attempts.length, 0);
});
test('qualifying assessment strict parser rejects diagnostic promotion, score mismatch and answer duplication', async () => {
  const f = fixture();
  await f.submit();
  const row = f.state.grades[0]!;
  for (const change of [
    { purpose: 'DIAGNOSTIC' },
    { score: 70 },
    { studentAnswer: 'private' },
    { attemptNumber: 2 },
  ])
    assert.equal(
      completionAssessmentRecord.safeParse({ ...row, ...change }).success,
      false,
    );
});
test('concurrent identical requests converge without duplicate attempt, grade or activity', async () => {
  const f = fixture(),
    [first, second] = await Promise.all([f.submit(), f.submit()]);
  assert.deepEqual(first, second);
  assert.equal(f.state.attempts.length, 1);
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.events.filter((e) => e === 'activity').length, 1);
});
test('concurrent distinct keys retain only the original first-submission assessment', async () => {
  const f = fixture();
  await Promise.all([
    f.submit({ studentAnswer: 'wrong' }),
    f.submit({ idempotencyKey: '22222222-2222-4222-8222-222222222222' }),
  ]);
  assert.equal(f.state.attempts.length, 2);
  assert.equal(f.state.grades.length, 1);
  assert.equal(f.state.grades[0]!.score, 0);
});
test('unavailable qualifying-index readiness refuses before any transactional mutation', async () => {
  const f = fixture();
  f.state.readyFault = true;
  await assert.rejects(f.submit());
  assert.equal(f.state.attempts.length, 0);
  assert.equal(f.state.grades.length, 0);
});
test('postcommit proof must match the exact original assessment outcome, not just its identity', async () => {
  const f = fixture();
  f.state.corruptProof = true;
  await assert.rejects(f.submit({ studentAnswer: 'wrong' }));
  assert.equal(f.state.attempts.length, 1);
  assert.equal(f.state.grades[0]!.score, 0);
});
