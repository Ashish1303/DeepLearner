import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import {
  evaluateCompletionPolicy as evaluate,
  type CompletionPolicyInput,
  type SectionEvidence,
  type CompletionBlockerCode,
  type CompletionSection,
} from '../src/modules/progress/completion-policy.js';

const binding = {
  studentId: 'a'.repeat(24),
  conceptId: 'b'.repeat(24),
  conceptRevision: 'concept-v1',
  policyId: 'concept-policy',
  policyRevision: 'policy-v1',
};
function section(name: SectionEvidence['section']): SectionEvidence {
  return {
    ...binding,
    evidenceId: 'evidence-' + name,
    section: name,
    verification: 'VERIFIED',
    outcome: 'COMPLETED',
  };
}
function fixture() {
  return {
    schemaVersion: 1 as const,
    subject: {
      studentId: binding.studentId,
      conceptId: binding.conceptId,
      conceptRevision: binding.conceptRevision,
    },
    policy: { id: binding.policyId, revision: binding.policyRevision },
    sectionEvidence: [
      section('READ'),
      section('VISUALIZE'),
      section('EXAMPLE'),
    ],
    practiceEvidence: {
      ...binding,
      evaluationId: 'synthetic-evaluation',
      attemptId: 'c'.repeat(24),
      questionId: 'd'.repeat(24),
      questionRevision: 'e'.repeat(64),
      type: 'OUTPUT' as const,
      verification: 'VERIFIED' as const,
      gradingStatus: 'GRADED' as const,
      score: 70,
    },
  } satisfies CompletionPolicyInput;
}
const eligible = { eligibility: 'ELIGIBLE', blockers: [] };
function without(input: object, key: string) {
  const copy: Record<string, unknown> = { ...input };
  delete copy[key];
  return copy;
}
function blocked(
  input: unknown,
  code: CompletionBlockerCode,
  name?: CompletionSection,
) {
  const value = evaluate(input);
  assert.equal(value.eligibility, 'INELIGIBLE');
  assert(value.blockers.some((b) => b.code === code && b.section === name));
  return value;
}

test('valid synthetic verified evidence at default 70 meets only candidate eligibility', () => {
  assert.deepEqual(evaluate(fixture()), eligible);
  for (const type of ['OUTPUT', 'DESCRIPTIVE', 'SCENARIO', 'CODING']) {
    const f = fixture();
    assert.deepEqual(
      evaluate({ ...f, practiceEvidence: { ...f.practiceEvidence, type } }),
      eligible,
    );
  }
});

test('default threshold compares below, at and above 70 without rounding or inventing scores', () => {
  for (const score of [0, 69, 69.999, 70, 70.001, 100]) {
    const f = fixture(),
      input = { ...f, practiceEvidence: { ...f.practiceEvidence, score } };
    if (score < 70)
      assert.deepEqual(evaluate(input), {
        eligibility: 'INELIGIBLE',
        blockers: [
          { code: 'PRACTICE_SCORE_BELOW_THRESHOLD', section: 'PRACTICE' },
        ],
      });
    else assert.deepEqual(evaluate(input), eligible);
  }
});

test('explicit thresholds 0, 50, 80 and 100 override default but never waive graded evidence', () => {
  for (const threshold of [0, 50, 80, 100]) {
    const f = fixture(),
      policy = { ...f.policy, minimumScore: threshold };
    assert.deepEqual(
      evaluate({
        ...f,
        policy,
        practiceEvidence: { ...f.practiceEvidence, score: threshold },
      }),
      eligible,
    );
    if (threshold > 0)
      blocked(
        {
          ...f,
          policy,
          practiceEvidence: { ...f.practiceEvidence, score: threshold - 0.001 },
        },
        'PRACTICE_SCORE_BELOW_THRESHOLD',
        'PRACTICE',
      );
    const absent = without(f, 'practiceEvidence');
    blocked({ ...absent, policy }, 'EVIDENCE_MISSING', 'PRACTICE');
    blocked(
      {
        ...f,
        policy,
        practiceEvidence: {
          ...f.practiceEvidence,
          gradingStatus: 'UNGRADED',
          score: null,
        },
      },
      'PRACTICE_UNGRADED',
      'PRACTICE',
    );
  }
});

test('invalid or explicitly undefined thresholds fail instead of using default', () => {
  for (const minimumScore of [
    undefined,
    null,
    true,
    '70',
    -1,
    101,
    70.5,
    NaN,
    Infinity,
    -Infinity,
    {},
    [],
  ]) {
    const f = fixture();
    blocked(
      { ...f, policy: { ...f.policy, minimumScore } },
      'INVALID_CONFIGURATION',
    );
  }
});

test('invalid scores and contradictory graded/null or ungraded/numeric metadata are rejected', () => {
  for (const score of [
    undefined,
    null,
    true,
    '100',
    -1,
    101,
    NaN,
    Infinity,
    -Infinity,
    {},
    [],
  ]) {
    const f = fixture();
    blocked(
      { ...f, practiceEvidence: { ...f.practiceEvidence, score } },
      'INVALID_INPUT',
    );
  }
  const f = fixture();
  blocked(
    {
      ...f,
      practiceEvidence: {
        ...f.practiceEvidence,
        gradingStatus: 'UNGRADED',
        score: 100,
      },
    },
    'INVALID_INPUT',
  );
  blocked(
    {
      ...f,
      practiceEvidence: { ...f.practiceEvidence, gradingStatus: 'PASSED' },
    },
    'INVALID_INPUT',
  );
});

test('missing, ungraded and unverified practice cannot satisfy required Practice', () => {
  const f = fixture(),
    missing = without(f, 'practiceEvidence');
  blocked(missing, 'EVIDENCE_MISSING', 'PRACTICE');
  blocked({ ...f, practiceEvidence: undefined }, 'INVALID_INPUT');
  blocked(
    {
      ...f,
      practiceEvidence: {
        ...f.practiceEvidence,
        gradingStatus: 'UNGRADED',
        score: null,
      },
    },
    'PRACTICE_UNGRADED',
    'PRACTICE',
  );
  blocked(
    {
      ...f,
      practiceEvidence: {
        ...f.practiceEvidence,
        verification: 'UNVERIFIED',
        score: 100,
      },
    },
    'EVIDENCE_UNVERIFIED',
    'PRACTICE',
  );
});

test('F036 ungraded submissions and F037 activity are never accepted as passing proof', () => {
  const f = fixture(),
    attempt = {
      result: 'SUBMITTED',
      score: null,
      studentAnswer: 'PRIVATE_INPUT',
      attemptNumber: 100,
    };
  const progress = {
    conceptId: binding.conceptId,
    status: 'IN_PROGRESS',
    attemptCount: 100,
    startedAt: null,
    lastActivityAt: null,
  };
  const before = JSON.stringify({ attempt, progress });
  blocked({ ...f, practiceEvidence: attempt }, 'INVALID_INPUT');
  blocked({ ...f, practiceEvidence: progress }, 'INVALID_INPUT');
  blocked({ ...f, attemptCount: 100 }, 'INVALID_INPUT');
  assert.equal(JSON.stringify({ attempt, progress }), before);
});

test('each absent default learning section independently blocks eligibility', () => {
  for (const missing of ['READ', 'VISUALIZE', 'EXAMPLE']) {
    const f = fixture();
    assert.deepEqual(
      evaluate({
        ...f,
        sectionEvidence: f.sectionEvidence.filter(
          (row) => row.section !== missing,
        ),
      }),
      {
        eligibility: 'INELIGIBLE',
        blockers: [{ code: 'EVIDENCE_MISSING', section: missing }],
      },
    );
  }
  const f = fixture(),
    missing = without(f, 'sectionEvidence');
  assert.deepEqual(evaluate(missing).blockers, [
    { code: 'EVIDENCE_MISSING', section: 'READ' },
    { code: 'EVIDENCE_MISSING', section: 'VISUALIZE' },
    { code: 'EVIDENCE_MISSING', section: 'EXAMPLE' },
  ]);
});

test('verified completion is required; visits, playback and incomplete/unverified records are not proof', () => {
  const f = fixture();
  for (const patch of [
    { verification: 'UNVERIFIED' },
    { outcome: 'INCOMPLETE' },
  ]) {
    const value = evaluate({
      ...f,
      sectionEvidence: f.sectionEvidence.map((row) =>
        row.section === 'READ' ? { ...row, ...patch } : row,
      ),
    });
    assert.equal(value.eligibility, 'INELIGIBLE');
    assert(
      value.blockers.some(
        (b) =>
          b.code ===
            ('verification' in patch
              ? 'EVIDENCE_UNVERIFIED'
              : 'EVIDENCE_INCOMPLETE') && b.section === 'READ',
      ),
    );
  }
  for (const extra of [
    { visited: true },
    { played: true },
    { completed: true },
  ])
    blocked(
      { ...f, sectionEvidence: [{ ...section('READ'), ...extra }] },
      'INVALID_INPUT',
    );
});

test('Visualize and Practice cannot be removed while other required sections remain configurable', () => {
  const f = fixture();
  for (const requiredSections of [
    ['READ'],
    ['VISUALIZE'],
    ['PRACTICE'],
    ['READ', 'EXAMPLE', 'PRACTICE'],
  ])
    blocked(
      { ...f, policy: { ...f.policy, requiredSections } },
      'UNSUPPORTED_CONFIGURATION',
    );
  assert.deepEqual(
    evaluate({
      ...f,
      policy: { ...f.policy, requiredSections: ['VISUALIZE', 'PRACTICE'] },
      sectionEvidence: [section('VISUALIZE')],
    }),
    eligible,
  );
});

test('Revise is optional until explicitly required; invalid optional evidence still fails closed', () => {
  const f = fixture(),
    requiredSections = ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE', 'REVISE'];
  assert.deepEqual(evaluate(f), eligible);
  const incomplete = {
    ...section('REVISE'),
    outcome: 'INCOMPLETE',
    verification: 'UNVERIFIED',
  };
  assert.deepEqual(
    evaluate({ ...f, sectionEvidence: [...f.sectionEvidence, incomplete] }),
    eligible,
  );
  const input = { ...f, policy: { ...f.policy, requiredSections } };
  blocked(input, 'EVIDENCE_MISSING', 'REVISE');
  assert.deepEqual(
    evaluate({
      ...input,
      sectionEvidence: [...f.sectionEvidence, section('REVISE')],
    }),
    eligible,
  );
  blocked(
    { ...input, sectionEvidence: [...f.sectionEvidence, incomplete] },
    'EVIDENCE_INCOMPLETE',
    'REVISE',
  );
  blocked(
    {
      ...f,
      sectionEvidence: [
        ...f.sectionEvidence,
        { ...section('REVISE'), conceptRevision: 'stale' },
      ],
    },
    'EVIDENCE_REVISION_MISMATCH',
    'REVISE',
  );
  blocked(
    {
      ...f,
      sectionEvidence: [
        ...f.sectionEvidence,
        { ...section('REVISE'), unknown: true },
      ],
    },
    'INVALID_INPUT',
  );
});

test('unknown, duplicate, empty or malformed section configurations never fall back', () => {
  const f = fixture();
  for (const requiredSections of [
    undefined,
    null,
    [],
    'READ',
    ['read'],
    ['VISUALIZE', 'PRACTICE', 'QUIZ'],
    ['VISUALIZE', 'PRACTICE', 'VISUALIZE'],
  ])
    blocked(
      { ...f, policy: { ...f.policy, requiredSections } },
      'INVALID_CONFIGURATION',
    );
  blocked(
    { ...f, policy: { ...f.policy, override: true } },
    'INVALID_CONFIGURATION',
  );
  blocked(
    { ...f, sectionEvidence: [{ ...section('READ'), section: 'PRACTICE' }] },
    'INVALID_INPUT',
  );
});

test('account, Concept and policy identities bind every supplied section and graded candidate', () => {
  const f = fixture();
  for (const patch of [
    { studentId: '1'.repeat(24) },
    { conceptId: '2'.repeat(24) },
    { policyId: 'another-policy' },
  ]) {
    blocked(
      {
        ...f,
        sectionEvidence: f.sectionEvidence.map((row) =>
          row.section === 'READ' ? { ...row, ...patch } : row,
        ),
      },
      'EVIDENCE_SCOPE_MISMATCH',
      'READ',
    );
    blocked(
      { ...f, practiceEvidence: { ...f.practiceEvidence, ...patch } },
      'EVIDENCE_SCOPE_MISMATCH',
      'PRACTICE',
    );
  }
});

test('Concept and policy revisions bind every supplied section and graded candidate', () => {
  const f = fixture();
  for (const patch of [
    { conceptRevision: 'stale-concept' },
    { policyRevision: 'stale-policy' },
  ]) {
    blocked(
      {
        ...f,
        sectionEvidence: f.sectionEvidence.map((row) =>
          row.section === 'READ' ? { ...row, ...patch } : row,
        ),
      },
      'EVIDENCE_REVISION_MISMATCH',
      'READ',
    );
    blocked(
      { ...f, practiceEvidence: { ...f.practiceEvidence, ...patch } },
      'EVIDENCE_REVISION_MISMATCH',
      'PRACTICE',
    );
  }
});

test('missing or unsupported evaluator versions are rejected independently of policy revision', () => {
  const f = fixture();
  for (const schemaVersion of [undefined, null, 0, 2, '1', true])
    blocked({ ...f, schemaVersion }, 'UNSUPPORTED_VERSION');
  const missing = without(f, 'schemaVersion');
  blocked(missing, 'UNSUPPORTED_VERSION');
  blocked(
    { ...f, policy: { ...f.policy, revision: '' } },
    'INVALID_CONFIGURATION',
  );
});

test('duplicate section rows and cross-section evidence rebinding fail deterministically', () => {
  const f = fixture();
  blocked(
    { ...f, sectionEvidence: [...f.sectionEvidence, section('READ')] },
    'EVIDENCE_CONFLICT',
    'READ',
  );
  const rows = f.sectionEvidence.map((row) => ({
    ...row,
    evidenceId: 'reused',
  }));
  const expected = {
    eligibility: 'INELIGIBLE',
    blockers: [
      { code: 'EVIDENCE_CONFLICT', section: 'READ' },
      { code: 'EVIDENCE_CONFLICT', section: 'VISUALIZE' },
      { code: 'EVIDENCE_CONFLICT', section: 'EXAMPLE' },
    ],
  };
  assert.deepEqual(evaluate({ ...f, sectionEvidence: rows }), expected);
  assert.deepEqual(
    evaluate({ ...f, sectionEvidence: rows.slice().reverse() }),
    expected,
  );
});

test('blockers are deduplicated, ordered and contain no raw identity or sensitive data', () => {
  const f = fixture();
  const rows = [section('READ'), section('READ')].map((row) => ({
    ...row,
    studentId: '1'.repeat(24),
    verification: 'UNVERIFIED',
    outcome: 'INCOMPLETE',
  }));
  const value = evaluate({ ...f, sectionEvidence: rows });
  assert.deepEqual(value.blockers, [
    { code: 'EVIDENCE_MISSING', section: 'VISUALIZE' },
    { code: 'EVIDENCE_MISSING', section: 'EXAMPLE' },
    { code: 'EVIDENCE_UNVERIFIED', section: 'READ' },
    { code: 'EVIDENCE_INCOMPLETE', section: 'READ' },
    { code: 'EVIDENCE_CONFLICT', section: 'READ' },
    { code: 'EVIDENCE_SCOPE_MISMATCH', section: 'READ' },
  ]);
  assert.deepEqual(Object.keys(value).sort(), ['blockers', 'eligibility']);
  assert.doesNotMatch(
    JSON.stringify(value),
    /studentId|conceptId|evaluationId|answer|score|completedAt/,
  );
  for (const entry of value.blockers)
    assert.deepEqual(Object.keys(entry).sort(), ['code', 'section']);
});

test('strict identities and bounded revision tokens reject normalization and malformed metadata', () => {
  const f = fixture();
  for (const studentId of ['', 'A'.repeat(24), 'a'.repeat(24) + '\n', 123])
    blocked({ ...f, subject: { ...f.subject, studentId } }, 'INVALID_INPUT');
  for (const conceptRevision of [
    '',
    ' revision',
    'revision\n',
    'a'.repeat(129),
    1,
  ])
    blocked(
      { ...f, subject: { ...f.subject, conceptRevision } },
      'INVALID_INPUT',
    );
  for (const questionRevision of [
    'x'.repeat(64),
    'E'.repeat(64),
    'e'.repeat(64) + '\n',
  ])
    blocked(
      { ...f, practiceEvidence: { ...f.practiceEvidence, questionRevision } },
      'INVALID_INPUT',
    );
  blocked({ ...f, practiceEvidence: [f.practiceEvidence] }, 'INVALID_INPUT');
});

test('malformed containers, unknown fields and excess evidence do not disclose validator errors', () => {
  for (const input of [
    null,
    undefined,
    [],
    1,
    'PRIVATE',
    true,
    () => {},
    new Date(),
    new Map(),
    { ...fixture(), answer: 'PRIVATE' },
  ])
    assert.deepEqual(evaluate(input), {
      eligibility: 'INELIGIBLE',
      blockers: [{ code: 'INVALID_INPUT' }],
    });
  const f = fixture();
  blocked(
    {
      ...f,
      sectionEvidence: [
        section('READ'),
        section('VISUALIZE'),
        section('EXAMPLE'),
        section('REVISE'),
        section('READ'),
      ],
    },
    'INVALID_INPUT',
  );
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  blocked(cycle, 'INVALID_INPUT');
});

test('accessors, proxies, sparse arrays and hidden/symbol fields are rejected without calling supplied code', () => {
  let calls = 0;
  const f = fixture();
  const accessor = Object.defineProperty({ ...f }, 'subject', {
    enumerable: true,
    get() {
      calls++;
      return f.subject;
    },
  });
  blocked(accessor, 'INVALID_INPUT');
  const proxy = new Proxy(f, {
    ownKeys() {
      calls++;
      throw Error('PRIVATE');
    },
    getPrototypeOf() {
      calls++;
      throw Error('PRIVATE');
    },
  });
  blocked(proxy, 'INVALID_INPUT');
  const revoked = Proxy.revocable(f, {});
  revoked.revoke();
  blocked(revoked.proxy, 'INVALID_INPUT');
  const nested = {
    ...f,
    practiceEvidence: Object.defineProperty(
      { ...f.practiceEvidence },
      'score',
      {
        enumerable: true,
        get() {
          calls++;
          return 100;
        },
      },
    ),
  };
  blocked(nested, 'INVALID_INPUT');
  blocked({ ...f, sectionEvidence: new Array(3) }, 'INVALID_INPUT');
  blocked(
    Object.defineProperty({ ...f }, 'secret', { value: true }),
    'INVALID_INPUT',
  );
  blocked({ ...f, [Symbol('hidden')]: true }, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('repeated evaluation and evidence-order changes preserve input and independent fresh outputs', () => {
  const f = fixture(),
    before = JSON.stringify(f);
  function freeze(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const entry of Object.values(value)) freeze(entry);
    Object.freeze(value);
  }
  freeze(f);
  const a = evaluate(f),
    b = evaluate(f);
  assert.deepEqual(a, eligible);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
  assert.notEqual(a.blockers, b.blockers);
  assert.deepEqual(
    evaluate({ ...f, sectionEvidence: f.sectionEvidence.slice().reverse() }),
    eligible,
  );
  assert.equal(JSON.stringify(f), before);
});

test('policy module dependency boundary excludes runtime repositories, persistence and grading', () => {
  const source = ts.createSourceFile(
    'completion-policy.ts',
    readFileSync(
      new URL('../src/modules/progress/completion-policy.ts', import.meta.url),
      'utf8',
    ),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = source.statements
    .filter(ts.isImportDeclaration)
    .map((s) => (s.moduleSpecifier as ts.StringLiteral).text)
    .sort();
  assert.deepEqual(imports, ['node:util', 'zod']);
});
