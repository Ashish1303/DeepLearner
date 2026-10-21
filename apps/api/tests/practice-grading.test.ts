import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types, type ClientSession } from 'mongoose';
import { Audit } from '../src/modules/audit/audit.model.js';
import { appendRubricAudit } from '../src/modules/audit/audit.repository.js';
import { createAccessTokens } from '../src/modules/auth/access-token.service.js';
import { AppError } from '../src/common/errors/app-error.js';
import { createPracticeGradingService } from '../src/modules/practice/practice-grading.service.js';
import {
  createGradingRepository,
  gradingIndexes,
  verifyGradingIndex,
  assessmentIdentity,
  type GradingStore,
} from '../src/modules/practice/practice-assessment.repository.js';
import {
  GradingWriteConflict,
  gradingUnavailable,
} from '../src/modules/practice/practice-rubric.repository.js';
import {
  PracticeRubricVersion,
  PracticeRubricAuthority,
  rubricDefinition,
  rubricAuthority,
  definitionFingerprint,
  sha256,
  type RubricDefinition,
  type RubricAuthority,
} from '../src/modules/practice/practice-rubric.model.js';
import {
  PracticeAssessment,
  assessmentRecord,
  type AssessmentRecord,
} from '../src/modules/practice/practice-assessment.model.js';
import type { AttemptRecord } from '../src/modules/practice/practice-attempt.model.js';
import type { QualifiedPractice } from '../src/modules/practice/practice.dto.js';

const id = (n: number) => new Types.ObjectId(n.toString(16).padStart(24, '0'));
const author = id(1),
  reviewer = id(2),
  student = id(3),
  other = id(4),
  question = id(5),
  concept = id(6);
type AuditWrite = Parameters<GradingStore['audit']>[0];
const identityKey = (row: ReturnType<typeof assessmentIdentity>) =>
  JSON.stringify(row);
async function fixture() {
  const state = {
    definitions: new Map<string, RubricDefinition>(),
    authorities: new Map<string, RubricAuthority>(),
    assessments: new Map<string, AssessmentRecord>(),
    audits: new Map<string, AuditWrite>(),
    actors: new Map([
      [author.toHexString(), 'ADMIN'],
      [reviewer.toHexString(), 'ADMIN'],
      [student.toHexString(), 'STUDENT'],
      [other.toHexString(), 'STUDENT'],
    ]),
    attempts: new Map<string, AttemptRecord>(),
    events: [] as string[],
    options: {} as Record<string, unknown>,
    readyFault: false,
    auditFault: false,
    assessmentFault: false,
    unknownCommit: false,
    cleanupFault: false,
    proofFault: false,
    fenceFaults: 0,
    sessions: 0,
    closed: 0,
    reviewerAfterCommit: false,
    content: {
      data: {
        id: question.toHexString(),
        conceptId: concept.toHexString(),
        type: 'OUTPUT',
        answer: 'PRIVATE_OFFICIAL',
        explanation: 'PRIVATE_EXPLANATION',
      },
      questionRevision: 'a'.repeat(64),
      contentFingerprint: 'b'.repeat(64),
    } as QualifiedPractice | null,
  };
  const attempt: AttemptRecord = {
    _id: id(7),
    userId: student,
    questionId: question,
    conceptId: concept,
    type: 'OUTPUT',
    questionRevision: 'a'.repeat(64),
    contentFingerprint: 'b'.repeat(64),
    attemptNumber: 1,
    studentAnswer: '42',
    submittedAt: new Date(),
    result: 'SUBMITTED',
    score: null,
    idempotencyKeyHash: 'c'.repeat(64),
    requestFingerprint: sha256([
      'F036-request-v1',
      student.toHexString(),
      question.toHexString(),
      concept.toHexString(),
      'a'.repeat(64),
      '42',
    ]),
    schemaVersion: 1,
  };
  state.attempts.set(attempt._id.toHexString(), attempt);
  let gate = Promise.resolve();
  const store: GradingStore = {
    async ready() {
      state.events.push('ready');
      if (state.readyFault) throw gradingUnavailable();
    },
    async session() {
      state.sessions++;
      let active = false;
      return {
        inTransaction: () => active,
        async withTransaction(
          work: () => Promise<void>,
          options: Record<string, unknown>,
        ) {
          const prior = gate;
          let release = () => {};
          gate = new Promise<void>((resolve) => {
            release = resolve;
          });
          await prior;
          state.options = options;
          const backup = {
            definitions: new Map(state.definitions),
            authorities: new Map(state.authorities),
            assessments: new Map(state.assessments),
            audits: new Map(state.audits),
          };
          let committed = false;
          try {
            active = true;
            state.events.push('body');
            await work();
            active = false;
            committed = true;
            state.events.push('commit');
            if (state.reviewerAfterCommit)
              state.actors.delete(reviewer.toHexString());
            if (state.unknownCommit) {
              state.unknownCommit = false;
              throw { errorLabels: ['UnknownTransactionCommitResult'] };
            }
          } catch (error) {
            if (!committed) Object.assign(state, backup);
            throw error;
          } finally {
            active = false;
            release();
          }
        },
        async endSession() {
          state.closed++;
          if (state.cleanupFault) throw new Error('PRIVATE_CLEANUP');
        },
      } as unknown as ClientSession;
    },
    async actor(value, role) {
      if (state.actors.get(value) !== role)
        throw new AppError(
          403,
          'AUTH_FORBIDDEN',
          'Current eligible account required',
        );
    },
    async qualified() {
      return state.content;
    },
    async definition(rid, version) {
      return (
        [...state.definitions.values()].find(
          (r) => r.rubricId.equals(rid) && r.version === version,
        ) ?? null
      );
    },
    async definitionById(rid) {
      return state.definitions.get(rid.toHexString()) ?? null;
    },
    async lastVersion(rid) {
      return Math.max(
        0,
        ...[...state.definitions.values()]
          .filter((r) => r.rubricId.equals(rid))
          .map((r) => r.version),
      );
    },
    async insertDefinition(row, read) {
      assert(read.session?.inTransaction());
      state.definitions.set(row._id.toHexString(), row);
    },
    async authority(rid, version) {
      return state.authorities.get(rid.toHexString() + ':' + version) ?? null;
    },
    async insertAuthority(row, read) {
      assert(read.session?.inTransaction());
      state.authorities.set(
        row.rubricId.toHexString() + ':' + row.version,
        row,
      );
    },
    async fence(row, read, revoke) {
      assert(read.session?.inTransaction());
      state.events.push('fence');
      if (state.fenceFaults-- > 0) throw new GradingWriteConflict();
      const key = row.rubricId.toHexString() + ':' + row.version,
        current = state.authorities.get(key);
      if (
        !current ||
        current.state !== 'APPROVED' ||
        current.decisionFence !== row.decisionFence
      )
        throw new GradingWriteConflict();
      if (row.decisionFence >= Number.MAX_SAFE_INTEGER)
        throw gradingUnavailable();
      const next = rubricAuthority.parse({
        ...row,
        decisionFence: row.decisionFence + 1,
        ...(revoke
          ? {
              state: 'REVOKED',
              revokedBy: revoke.actor,
              revokedAt: revoke.time,
              revocationAuditId: revoke.auditId,
            }
          : {}),
      });
      state.authorities.set(key, next);
      return next;
    },
    async audit(row, read) {
      assert(read.session?.inTransaction());
      if (state.auditFault) throw Error('PRIVATE_AUDIT');
      state.audits.set(row.id.toHexString(), row);
    },
    async auditProof(d, actor, action, time, _read, auditId) {
      const rows = [...state.audits.values()].filter(
        (r) =>
          (!auditId || r.id.equals(auditId)) &&
          r.definitionId.equals(d._id) &&
          r.actorId.equals(actor) &&
          r.action === action,
      );
      if (
        rows.length !== 1 ||
        rows[0]!.rubricVersion !== d.version ||
        rows[0]!.createdAt.getTime() !== time.getTime()
      )
        throw gradingUnavailable();
    },
    async attempt(aid, owner, read) {
      state.events.push(
        read.majority ? 'majority-attempt' : 'snapshot-attempt',
      );
      const row = state.attempts.get(aid.toHexString());
      return row?.userId.equals(owner) ? row : null;
    },
    async assessment(key) {
      return state.assessments.get(identityKey(key)) ?? null;
    },
    async assessmentProof(aid, owner) {
      if (state.proofFault) return null;
      return (
        [...state.assessments.values()].find(
          (r) => r._id.equals(aid) && r.userId.equals(owner),
        ) ?? null
      );
    },
    async insertAssessment(row, read) {
      assert(read.session?.inTransaction());
      if (state.assessmentFault) throw Error('PRIVATE_ASSESSMENT');
      state.assessments.set(identityKey(assessmentIdentity(row)), row);
    },
  };
  const tokens = createAccessTokens({
    ACCESS_TOKEN_SECRET: Buffer.alloc(32, 7).toString('base64'),
    ACCESS_TOKEN_ISSUER: 'test',
    ACCESS_TOKEN_AUDIENCE: 'test',
  });
  const jwt = {
    author: await tokens.sign({
      sub: author.toHexString(),
      role: 'ADMIN',
      sid: id(20).toHexString(),
      plan: 'FREE',
    }),
    reviewer: await tokens.sign({
      sub: reviewer.toHexString(),
      role: 'ADMIN',
      sid: id(21).toHexString(),
      plan: 'FREE',
    }),
    student: await tokens.sign({
      sub: student.toHexString(),
      role: 'STUDENT',
      sid: id(22).toHexString(),
      plan: 'FREE',
    }),
    other: await tokens.sign({
      sub: other.toHexString(),
      role: 'STUDENT',
      sid: id(23).toHexString(),
      plan: 'FREE',
    }),
  };
  const repository = createGradingRepository(store);
  const service = createPracticeGradingService(
    tokens,
    { APP_ENV: 'LOCAL' },
    repository,
  );
  const draft = {
    questionId: question.toHexString(),
    conceptId: concept.toHexString(),
    questionRevision: 'a'.repeat(64),
    type: 'OUTPUT',
    answerForm: 'TEXT',
    comparison: 'EXACT_TEXT',
    normalization: 'NONE',
    expectedAnswer: '42',
  };
  async function approved() {
    const row = await service.author(jwt.author, draft, 'author-1');
    await service.approve(
      jwt.reviewer,
      { rubricId: row.rubricId, version: row.version },
      'approve-1',
    );
    return {
      attemptId: attempt._id.toHexString(),
      rubricId: row.rubricId,
      rubricVersion: row.version,
    };
  }
  return {
    state,
    store,
    tokens,
    jwt,
    repository,
    service,
    draft,
    approved,
    attempt,
  };
}
async function rejects(work: Promise<unknown>, code: string) {
  await assert.rejects(
    work,
    (e) =>
      e instanceof AppError &&
      e.code === code &&
      !JSON.stringify(e).includes('PRIVATE_'),
  );
}

test('independent Admin review and owned diagnostic grade have exact private receipts', async () => {
  const f = await fixture(),
    input = await f.approved(),
    before = JSON.stringify(f.attempt);
  const result = await f.service.gradeDiagnostic(
    f.jwt.student,
    input,
    'grade-1',
  );
  assert.equal(result.outcome, 'CORRECT');
  assert.equal(result.score, 100);
  assert.equal(result.purpose, 'DIAGNOSTIC');
  assert.deepEqual(Object.keys(result).sort(), [
    'attemptId',
    'evaluatedAt',
    'id',
    'outcome',
    'purpose',
    'refusalCode',
    'score',
  ]);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
  assert.equal(JSON.stringify(f.attempt), before);
  assert.equal(f.state.assessments.size, 1);
  assert.equal(f.state.audits.size, 2);
  assert.equal(f.state.sessions, f.state.closed);
  assert(
    f.state.events.indexOf('majority-attempt') <
      f.state.events.lastIndexOf('body'),
  );
  assert.deepEqual(f.state.options.writeConcern, { w: 'majority', j: true });
  assert.deepEqual(f.state.options.readConcern, { level: 'snapshot' });
});

test('same logical author retry preserves version and event; edits get a new immutable version', async () => {
  const f = await fixture(),
    a = await f.service.author(f.jwt.author, f.draft, 'author-1');
  assert.deepEqual(
    await f.service.author(f.jwt.author, f.draft, 'author-1'),
    a,
  );
  assert.equal(f.state.audits.size, 1);
  await rejects(
    f.service.author(
      f.jwt.author,
      { ...f.draft, expectedAnswer: '43' },
      'author-1',
    ),
    'PRACTICE_ASSESSMENT_CONFLICT',
  );
  const b = await f.service.author(
    f.jwt.author,
    { ...f.draft, rubricId: a.rubricId, expectedAnswer: '43' },
    'author-2',
  );
  assert.equal(b.version, 2);
  assert.equal(f.state.definitions.size, 2);
});

test('invalid authored literals and unknown rubric families fail without stored drafts', async () => {
  const f = await fixture();
  for (const expectedAnswer of ['', ' \n', '\ud800', 'x'.repeat(10_001)])
    await rejects(
      f.service.author(
        f.jwt.author,
        { ...f.draft, expectedAnswer },
        'author-invalid',
      ),
      'VALIDATION_ERROR',
    );
  await rejects(
    f.service.author(
      f.jwt.author,
      { ...f.draft, rubricId: id(99).toHexString() },
      'author-unknown',
    ),
    'CONCEPT_NOT_FOUND',
  );
  assert.equal(f.state.definitions.size, 0);
});

test('self approval, wrong roles, forged tokens/claims and nonlocal use fail before writes', async () => {
  const f = await fixture(),
    d = await f.service.author(f.jwt.author, f.draft, 'author-1');
  await rejects(
    f.service.approve(
      f.jwt.author,
      { rubricId: d.rubricId, version: d.version },
      'approval',
    ),
    'AUTH_FORBIDDEN',
  );
  await rejects(
    f.service.author(f.jwt.student, f.draft, 'author'),
    'AUTH_FORBIDDEN',
  );
  await rejects(
    f.service.author(
      { sub: author.toHexString(), role: 'ADMIN' },
      f.draft,
      'author',
    ),
    'AUTH_ACCESS_TOKEN_INVALID',
  );
  await rejects(
    f.service.author(f.jwt.author.slice(0, -5) + 'xxxxx', f.draft, 'author'),
    'AUTH_ACCESS_TOKEN_INVALID',
  );
  await rejects(
    createPracticeGradingService(
      f.tokens,
      { APP_ENV: 'PRODUCTION' },
      f.repository,
    ).author(f.jwt.author, f.draft, 'author'),
    'ROUTE_NOT_FOUND',
  );
  assert.equal(f.state.authorities.size, 0);
});

test('current actor and independent reviewer eligibility is rechecked, not trusted from JWT role', async () => {
  const f = await fixture(),
    input = await f.approved();
  f.state.actors.set(student.toHexString(), 'ADMIN');
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'AUTH_FORBIDDEN',
  );
  f.state.actors.set(student.toHexString(), 'STUDENT');
  f.state.actors.delete(reviewer.toHexString());
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'AUTH_FORBIDDEN',
  );
  assert.equal(f.state.assessments.size, 0);
});

test('postcommit account change suppresses a result without pretending the saved diagnostic row vanished', async () => {
  const f = await fixture(),
    input = await f.approved();
  f.state.reviewerAfterCommit = true;
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'AUTH_FORBIDDEN',
  );
  assert.equal(f.state.assessments.size, 1);
});

test('arbitrary client rubric, authority and student identity properties are rejected', async () => {
  const f = await fixture(),
    input = await f.approved();
  for (const key of [
    'rubric',
    'approved',
    'studentId',
    'expectedAnswer',
    'score',
    'userId',
  ])
    await rejects(
      f.service.gradeDiagnostic(
        f.jwt.student,
        { ...input, [key]: true },
        'grade',
      ),
      'VALIDATION_ERROR',
    );
  await rejects(
    f.service.gradeDiagnostic(f.jwt.other, input, 'grade'),
    'CONCEPT_NOT_FOUND',
  );
  assert.equal(f.state.assessments.size, 0);
});

test('audit failure rolls back draft, approval and terminal revocation atomically', async () => {
  const f = await fixture();
  f.state.auditFault = true;
  await rejects(
    f.service.author(f.jwt.author, f.draft, 'author-1'),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(f.state.definitions.size, 0);
  f.state.auditFault = false;
  const d = await f.service.author(f.jwt.author, f.draft, 'author-1');
  f.state.auditFault = true;
  await rejects(
    f.service.approve(
      f.jwt.reviewer,
      { rubricId: d.rubricId, version: d.version },
      'approve',
    ),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(f.state.authorities.size, 0);
  f.state.auditFault = false;
  await f.service.approve(
    f.jwt.reviewer,
    { rubricId: d.rubricId, version: d.version },
    'approve',
  );
  f.state.auditFault = true;
  await rejects(
    f.service.revoke(
      f.jwt.author,
      { rubricId: d.rubricId, version: d.version },
      'revoke',
    ),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal([...f.state.authorities.values()][0]!.state, 'APPROVED');
  assert.equal(f.state.audits.size, 2);
});

test('revocation is terminal and replay after revocation cannot return a grade', async () => {
  const f = await fixture(),
    input = await f.approved();
  await f.service.gradeDiagnostic(f.jwt.student, input, 'grade');
  const command = { rubricId: input.rubricId, version: input.rubricVersion };
  await f.service.revoke(f.jwt.author, command, 'revoke');
  const eventCount = f.state.audits.size;
  await f.service.revoke(f.jwt.reviewer, command, 'revoke-again');
  assert.equal(f.state.audits.size, eventCount);
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'replay'),
    'AUTH_FORBIDDEN',
  );
  await rejects(
    f.service.approve(f.jwt.reviewer, command, 'restore'),
    'AUTH_FORBIDDEN',
  );
  assert.equal(f.state.assessments.size, 1);
});

test('known shared-fence conflicts retry within budget; exhaustion never inserts a grade', async () => {
  const f = await fixture(),
    input = await f.approved();
  f.state.fenceFaults = 2;
  await f.service.gradeDiagnostic(f.jwt.student, input, 'grade');
  assert.equal(f.state.assessments.size, 1);
  const g = await fixture(),
    next = await g.approved();
  g.state.fenceFaults = 5;
  await rejects(
    g.service.gradeDiagnostic(g.jwt.student, next, 'grade'),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(g.state.assessments.size, 0);
  assert.equal([...g.state.authorities.values()][0]!.decisionFence, 0);
});

test('identical concurrent submissions converge; replays retain id and time while fence advances', async () => {
  const f = await fixture(),
    input = await f.approved();
  const rows = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      f.service.gradeDiagnostic(f.jwt.student, input, 'request-' + i),
    ),
  );
  for (const row of rows) assert.deepEqual(row, rows[0]);
  assert.equal(f.state.assessments.size, 1);
  assert.equal([...f.state.authorities.values()][0]!.decisionFence, 4);
});

test('both serialized grade/revoke commit orders preserve fail-closed diagnostic boundaries', async () => {
  for (const revokeFirst of [true, false]) {
    const f = await fixture(),
      input = await f.approved(),
      command = { rubricId: input.rubricId, version: input.rubricVersion };
    const actions = revokeFirst
      ? [
          f.service.revoke(f.jwt.author, command, 'revoke'),
          f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
        ]
      : [
          f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
          f.service.revoke(f.jwt.author, command, 'revoke'),
        ];
    await Promise.allSettled(actions);
    assert.equal([...f.state.authorities.values()][0]!.state, 'REVOKED');
    assert.equal(f.state.assessments.size, revokeFirst ? 0 : 1);
    await rejects(
      f.service.gradeDiagnostic(f.jwt.student, input, 'later'),
      'AUTH_FORBIDDEN',
    );
  }
});

test('unknown commit returns no result; explicit same identity resolves without duplicate assessment', async () => {
  const f = await fixture(),
    input = await f.approved();
  f.state.unknownCommit = true;
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'PRACTICE_ASSESSMENT_UNCONFIRMED',
  );
  assert.equal(f.state.assessments.size, 1);
  const replay = await f.service.gradeDiagnostic(
    f.jwt.student,
    input,
    'resolve',
  );
  assert.equal(replay.score, 100);
  assert.equal(f.state.assessments.size, 1);
});

test('missing majority proof or failed session cleanup prevents returning a result', async () => {
  for (const fault of ['proofFault', 'cleanupFault'] as const) {
    const f = await fixture(),
      input = await f.approved();
    f.state[fault] = true;
    await rejects(
      f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
      'PRACTICE_ASSESSMENT_UNCONFIRMED',
    );
    assert.equal(f.state.assessments.size, 1);
    assert.equal(f.state.sessions, f.state.closed);
  }
});

test('assessment failure rolls back fence and never touches saved attempts or progress', async () => {
  const f = await fixture(),
    input = await f.approved(),
    before = JSON.stringify(f.attempt);
  f.state.assessmentFault = true;
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(f.state.assessments.size, 0);
  assert.equal([...f.state.authorities.values()][0]!.decisionFence, 0);
  assert.equal(JSON.stringify(f.attempt), before);
});

test('missing readiness and missing approval provenance refuse before assessment writes', async () => {
  const f = await fixture(),
    input = await f.approved();
  f.state.readyFault = true;
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'DEPENDENCY_UNAVAILABLE',
  );
  f.state.readyFault = false;
  f.state.audits.clear();
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(f.state.assessments.size, 0);
});

test('exhausted total transaction budget starts no new body or assessment', async () => {
  const f = await fixture(),
    input = await f.approved();
  let now = 0;
  const timed = createPracticeGradingService(
    f.tokens,
    { APP_ENV: 'LOCAL' },
    createGradingRepository(f.store, () => {
      now += 6000;
      return now;
    }),
  );
  const bodies = f.state.events.filter((e) => e === 'body').length;
  await rejects(
    timed.gradeDiagnostic(f.jwt.student, input, 'expired'),
    'DEPENDENCY_UNAVAILABLE',
  );
  assert.equal(f.state.events.filter((e) => e === 'body').length, bodies);
  assert.equal(f.state.assessments.size, 0);
});

test('current publication/revision/private fingerprint and F036 request integrity bind every evaluation', async () => {
  for (const mutate of [
    (f: Awaited<ReturnType<typeof fixture>>) => {
      f.state.content = null;
    },
    (f: Awaited<ReturnType<typeof fixture>>) => {
      f.state.content!.questionRevision = 'f'.repeat(64);
    },
    (f: Awaited<ReturnType<typeof fixture>>) => {
      f.state.content!.contentFingerprint = 'f'.repeat(64);
    },
    (f: Awaited<ReturnType<typeof fixture>>) => {
      f.state.attempts.set(f.attempt._id.toHexString(), {
        ...f.attempt,
        studentAnswer: 'tampered',
      });
    },
  ]) {
    const f = await fixture(),
      input = await f.approved();
    mutate(f);
    await assert.rejects(
      f.service.gradeDiagnostic(f.jwt.student, input, 'grade'),
      (e) => e instanceof AppError && [404, 409, 503].includes(e.statusCode),
    );
    assert.equal(f.state.assessments.size, 0);
  }
});

test('valid wrong answers score zero; unsupported saved Unicode refuses with a null score', async () => {
  for (const [text, outcome, score] of [
    ['41', 'INCORRECT', 0],
    ['\ud800', 'REFUSED', null],
  ] as const) {
    const f = await fixture(),
      input = await f.approved();
    f.state.attempts.set(f.attempt._id.toHexString(), {
      ...f.attempt,
      studentAnswer: text,
      requestFingerprint: sha256([
        'F036-request-v1',
        student.toHexString(),
        question.toHexString(),
        concept.toHexString(),
        'a'.repeat(64),
        text,
      ]),
    });
    const result = await f.service.gradeDiagnostic(
      f.jwt.student,
      input,
      'grade',
    );
    assert.equal(result.outcome, outcome);
    assert.equal(result.score, score);
    const saved = [...f.state.assessments.values()][0]!;
    assert.equal('studentAnswer' in saved, false);
    assert.equal('expectedAnswer' in saved, false);
  }
});

test('stored assessment corruption cannot replay as an authorized grade', async () => {
  const f = await fixture(),
    input = await f.approved();
  await f.service.gradeDiagnostic(f.jwt.student, input, 'grade');
  const [key, row] = [...f.state.assessments.entries()][0]!;
  f.state.assessments.set(key, { ...row, outcome: 'INCORRECT', score: 0 });
  await rejects(
    f.service.gradeDiagnostic(f.jwt.student, input, 'replay'),
    'PRACTICE_ASSESSMENT_CONFLICT',
  );
});

test('all exact B2 unique indexes reject missing, wrong-order/nonunique or unapproved options', () => {
  for (const expected of gradingIndexes) {
    const valid = {
      v: 2,
      name: expected.name,
      key: expected.key,
      unique: true,
    };
    verifyGradingIndex([valid], expected);
    for (const row of [
      { ...valid, unique: false },
      { ...valid, key: {} },
      { ...valid, sparse: false },
      { ...valid, partialFilterExpression: {} },
      { ...valid, v: 1 },
    ])
      assert.throws(() => verifyGradingIndex([row], expected));
    assert.throws(() => verifyGradingIndex([], expected));
  }
});

test('strict rubric/authority/assessment models reject forbidden metadata and supported mutation paths offline', async () => {
  const f = await fixture(),
    input = await f.approved();
  await f.service.gradeDiagnostic(f.jwt.student, input, 'grade');
  const d = [...f.state.definitions.values()][0]!,
    a = [...f.state.authorities.values()][0]!,
    r = [...f.state.assessments.values()][0]!;
  assert.equal(d.definitionFingerprint, definitionFingerprint(d));
  assert.throws(() =>
    rubricDefinition.parse({ ...d, expectedAnswer: 'wrong' }),
  );
  assert.throws(() => rubricAuthority.parse({ ...a, reviewerId: a.authorId }));
  assert.throws(() =>
    assessmentRecord.parse({ ...r, studentAnswer: 'secret' }),
  );
  assert.throws(() => assessmentRecord.parse({ ...r, score: 50 }));
  for (const doc of [
    new PracticeRubricVersion(d),
    new PracticeRubricAuthority(a),
    new PracticeAssessment(r),
  ]) {
    await doc.validate();
    doc.isNew = false;
    await assert.rejects(doc.save(), /repository|append-only/);
  }
  for (const model of [
    PracticeRubricVersion,
    PracticeRubricAuthority,
    PracticeAssessment,
  ]) {
    assert.equal(model.db.readyState, 0);
    assert.equal(model.schema.options.autoIndex, false);
  }
  await assert.rejects(
    PracticeAssessment.updateOne({}, { $set: { score: 100 } }).exec(),
    /append-only/,
  );
  await assert.rejects(
    PracticeRubricVersion.deleteMany({}).exec(),
    /repository/,
  );
});

test('rubric audit discriminants preserve old User identity constraints and minimize metadata', async () => {
  const event = {
    category: 'CONTENT_APPROVAL',
    action: 'PRACTICE_RUBRIC_APPROVED',
    actorId: author,
    resourceId: question,
    resourceType: 'PRACTICE_RUBRIC',
    requestId: 'review',
    metadata: { rubricVersion: 1 },
  };
  await new Audit(event).validate();
  for (const patch of [
    { category: 'AUTH' },
    { resourceType: 'USER' },
    { actorId: null },
    { metadata: { rubricVersion: 1, source: 'ACCESS_TOKEN' } },
    { metadata: { rubricVersion: 1, expectedAnswer: 'secret' } },
  ])
    await assert.rejects(new Audit({ ...event, ...patch }).validate());
  await assert.rejects(
    new Audit({
      ...event,
      category: 'AUTH',
      action: 'AUTH_REGISTERED',
      resourceType: 'USER',
      metadata: { source: 'EMAIL_PASSWORD' },
    }).validate(),
  );
  await assert.rejects(
    appendRubricAudit(
      {
        id: id(8),
        actorId: author,
        definitionId: question,
        action: 'PRACTICE_RUBRIC_APPROVED',
        rubricVersion: 1,
        requestId: 'review',
        createdAt: new Date(),
      },
      { inTransaction: () => false } as ClientSession,
    ),
    /active transaction/,
  );
  await assert.rejects(Audit.deleteMany({}).exec(), /append-only/);
});
