import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {
  evaluateMasteryPolicy as evaluate,
  masteryPolicyRefusalCodes,
  type MasteryPolicyInput,
  type MasteryPolicyRefusalCode,
  type MasteryPolicyResult,
} from '../src/modules/progress/mastery-policy.js';

function fixture(score: unknown = 80) {
  const binding = {
    userId: '1'.repeat(24),
    conceptId: '2'.repeat(24),
    questionId: '3'.repeat(24),
    completionPolicyId: '4'.repeat(24),
    rubricId: '5'.repeat(24),
    conceptRevision: '1'.repeat(64),
    questionRevision: '2'.repeat(64),
    contentFingerprint: '3'.repeat(64),
    completionPolicyFingerprint: '4'.repeat(64),
    sourceEpoch: '5'.repeat(64),
    rubricDefinitionFingerprint: '6'.repeat(64),
    completionPolicyVersion: 1,
    rubricVersion: 1,
  };
  return {
    schemaVersion: 1,
    expected: {
      ...binding,
      selectedAttemptId: '6'.repeat(24),
      selectedAssessmentId: '7'.repeat(24),
      classificationPolicyId: 'F039_DEFAULT_MASTERY',
      classificationPolicyVersion: 1,
    },
    policy: {
      id: 'F039_DEFAULT_MASTERY',
      version: 1,
      improvingMinimum: 60,
      strongMinimum: 80,
    },
    assessment: {
      ...binding,
      attemptId: '6'.repeat(24),
      assessmentId: '7'.repeat(24),
      verification: 'VERIFIED',
      lifecycle: 'CURRENT',
      type: 'OUTPUT',
      purpose: 'COMPLETION_INPUT',
      graderId: 'OUTPUT_EXACT_TEXT_COMPLETION',
      graderVersion: 1,
      attemptNumber: 1,
      submissionProvenance: 'F036_FIRST_SUBMISSION_ATOMIC_V1',
      score,
    },
  } satisfies MasteryPolicyInput;
}

function refusal(input: unknown, code: MasteryPolicyRefusalCode): void {
  assert.deepEqual(evaluate(input), { classification: 'UNCLASSIFIED', code });
}
function classified(
  input: unknown,
  classification: 'WEAK' | 'IMPROVING' | 'STRONG',
): void {
  assert.deepEqual(evaluate(input), { classification, code: 'NONE' });
}

test('default thresholds classify exact boundaries and fractional neighbors without rounding', () => {
  for (const score of [0, -0, Number.MIN_VALUE, 59.999, 60 - 1e-12])
    classified(fixture(score), 'WEAK');
  for (const score of [60, 60 + 1e-12, 79.999, 80 - 1e-12])
    classified(fixture(score), 'IMPROVING');
  for (const score of [80, 80 + 1e-12, 99.999, 100])
    classified(fixture(score), 'STRONG');
});

test('explicit validated threshold profiles are used exactly without completion-threshold coupling', () => {
  for (const [improving, strong, score, result] of [
    [20, 90, 60, 'IMPROVING'],
    [20, 90, 80, 'IMPROVING'],
    [20, 90, 90, 'STRONG'],
    [0, 100, 0, 'IMPROVING'],
    [0, 100, 100, 'STRONG'],
    [99, 100, 98.999, 'WEAK'],
  ] as const) {
    const input = fixture(score);
    input.policy.improvingMinimum = improving;
    input.policy.strongMinimum = strong;
    input.policy.id = input.expected.classificationPolicyId =
      'Explicit.Profile:2';
    input.policy.version = input.expected.classificationPolicyVersion = 2;
    classified(input, result);
  }
});

test('policy is mandatory with no silent default when absent or invalid', () => {
  for (const policy of [null, undefined, {}, false, [], '60/80'])
    refusal({ ...fixture(), policy }, 'INVALID_POLICY');
  const { policy: omitted, ...root } = fixture();
  assert.ok(omitted);
  refusal(root, 'INVALID_INPUT');
});

test('threshold configuration rejects contradictory, noninteger and nonfinite values', () => {
  for (const [improvingMinimum, strongMinimum] of [
    [80, 60],
    [60, 60],
    [-1, 80],
    [60, 101],
    [60.5, 80],
    [60, 80.5],
    [NaN, 80],
    [60, Infinity],
    ['60', 80],
    [60, null],
  ]) {
    refusal(
      {
        ...fixture(),
        policy: { ...fixture().policy, improvingMinimum, strongMinimum },
      },
      'INVALID_POLICY',
    );
  }
});

test('policy and expected policy tokens and versions have strict bounded schemas', () => {
  for (const value of [
    '',
    'a'.repeat(65),
    ' policy',
    'policy\n',
    'é',
    'a/b',
    1,
  ]) {
    refusal(
      { ...fixture(), policy: { ...fixture().policy, id: value } },
      'INVALID_POLICY',
    );
    refusal(
      {
        ...fixture(),
        expected: { ...fixture().expected, classificationPolicyId: value },
      },
      'INVALID_CONTEXT',
    );
  }
  for (const value of [
    0,
    -1,
    1.5,
    Infinity,
    NaN,
    Number.MAX_SAFE_INTEGER + 1,
    '1',
  ]) {
    refusal(
      { ...fixture(), policy: { ...fixture().policy, version: value } },
      'INVALID_POLICY',
    );
    refusal(
      {
        ...fixture(),
        expected: { ...fixture().expected, classificationPolicyVersion: value },
      },
      'INVALID_CONTEXT',
    );
  }
  const input = fixture();
  input.policy.id = input.expected.classificationPolicyId = 'a'.repeat(64);
  input.policy.version = input.expected.classificationPolicyVersion =
    Number.MAX_SAFE_INTEGER;
  classified(input, 'STRONG');
});

test('all four root fields are required and unknown fields are rejected', () => {
  for (const key of Object.keys(fixture())) {
    const input: Record<string, unknown> = fixture();
    delete input[key];
    refusal(input, 'INVALID_INPUT');
  }
  for (const input of [
    null,
    undefined,
    true,
    1,
    'input',
    [],
    { ...fixture(), approved: true },
  ])
    refusal(input, 'INVALID_INPUT');
});

test('schema version distinguishes malformed values from unsupported numeric versions', () => {
  for (const schemaVersion of [
    '1',
    null,
    -1,
    NaN,
    Infinity,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    refusal({ ...fixture(), schemaVersion }, 'INVALID_INPUT');
  for (const schemaVersion of [0, 2, Number.MAX_SAFE_INTEGER])
    refusal({ ...fixture(), schemaVersion }, 'UNSUPPORTED_VERSION');
});

const idFields = [
  'userId',
  'conceptId',
  'questionId',
  'completionPolicyId',
  'rubricId',
] as const;
const digestFields = [
  'conceptRevision',
  'questionRevision',
  'contentFingerprint',
  'completionPolicyFingerprint',
  'sourceEpoch',
  'rubricDefinitionFingerprint',
] as const;
const versionFields = ['completionPolicyVersion', 'rubricVersion'] as const;

test('canonical identities reject malformed, uppercase, padded and alternate representations', () => {
  for (const key of idFields) {
    for (const value of [
      'a'.repeat(23),
      'a'.repeat(25),
      'A'.repeat(24),
      'g'.repeat(24),
      '1'.repeat(24) + '\n',
      123,
      null,
    ]) {
      refusal(
        { ...fixture(), expected: { ...fixture().expected, [key]: value } },
        'INVALID_CONTEXT',
      );
      refusal(
        { ...fixture(), assessment: { ...fixture().assessment, [key]: value } },
        'INVALID_ASSESSMENT',
      );
    }
  }
});

test('every digest and version binding is strictly validated on both sides', () => {
  for (const key of digestFields) {
    for (const value of [
      'a'.repeat(63),
      'a'.repeat(65),
      'A'.repeat(64),
      'a'.repeat(64) + '\n',
      null,
    ]) {
      refusal(
        { ...fixture(), expected: { ...fixture().expected, [key]: value } },
        'INVALID_CONTEXT',
      );
      refusal(
        { ...fixture(), assessment: { ...fixture().assessment, [key]: value } },
        'INVALID_ASSESSMENT',
      );
    }
  }
  for (const key of versionFields) {
    for (const value of [
      0,
      -1,
      0.5,
      NaN,
      Infinity,
      '1',
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      refusal(
        { ...fixture(), expected: { ...fixture().expected, [key]: value } },
        'INVALID_CONTEXT',
      );
      refusal(
        { ...fixture(), assessment: { ...fixture().assessment, [key]: value } },
        'INVALID_ASSESSMENT',
      );
    }
  }
});

test('missing context and assessment binding fields fail closed', () => {
  for (const key of Object.keys(fixture().expected)) {
    const expected: Record<string, unknown> = { ...fixture().expected };
    delete expected[key];
    refusal({ ...fixture(), expected }, 'INVALID_CONTEXT');
  }
  for (const key of Object.keys(fixture().assessment).filter(
    (key) => key !== 'score',
  )) {
    const assessment: Record<string, unknown> = { ...fixture().assessment };
    delete assessment[key];
    refusal({ ...fixture(), assessment }, 'INVALID_ASSESSMENT');
  }
});

test('selected attempt and assessment identities require paired nulls or canonical identifiers', () => {
  for (const [selectedAttemptId, selectedAssessmentId] of [
    [null, '7'.repeat(24)],
    ['6'.repeat(24), null],
    ['', '7'.repeat(24)],
    ['6'.repeat(24), 7],
  ])
    refusal(
      {
        ...fixture(),
        expected: {
          ...fixture().expected,
          selectedAttemptId,
          selectedAssessmentId,
        },
      },
      'INVALID_CONTEXT',
    );
  const expected = {
    ...fixture().expected,
    selectedAttemptId: null,
    selectedAssessmentId: null,
  };
  refusal({ ...fixture(), expected }, 'BINDING_MISMATCH');
  refusal({ ...fixture(), expected, assessment: null }, 'SCORE_MISSING');
});

test('every common binding and selected record must match exactly', () => {
  for (const key of [
    ...idFields,
    ...digestFields,
    ...versionFields,
    'attemptId',
    'assessmentId',
  ] as const) {
    const value = versionFields.includes(key as (typeof versionFields)[number])
      ? 2
      : 'a'.repeat(
          digestFields.includes(key as (typeof digestFields)[number]) ? 64 : 24,
        );
    refusal(
      { ...fixture(), assessment: { ...fixture().assessment, [key]: value } },
      'BINDING_MISMATCH',
    );
  }
  for (const policy of [
    { ...fixture().policy, id: 'Different' },
    { ...fixture().policy, version: 2 },
  ])
    refusal({ ...fixture(), policy }, 'BINDING_MISMATCH');
});

test('valid policy mismatch is still refused when no assessment is selected', () => {
  refusal(
    {
      ...fixture(),
      policy: { ...fixture().policy, version: 2 },
      assessment: null,
    },
    'BINDING_MISMATCH',
  );
});

test('unverified metadata never yields a label even with score 100', () => {
  refusal(
    {
      ...fixture(100),
      assessment: { ...fixture(100).assessment, verification: 'UNVERIFIED' },
    },
    'UNTRUSTED_ASSESSMENT',
  );
});

test('unsupported evidence is refused without selecting a substitute assessment', () => {
  for (const override of [
    { type: 'DESCRIPTIVE' },
    { type: 'SCENARIO' },
    { type: 'CODING' },
    { purpose: 'DIAGNOSTIC' },
    { graderId: 'OTHER_GRADER' },
    { graderVersion: 2 },
    { attemptNumber: 2 },
    { submissionProvenance: 'HISTORICAL' },
  ])
    refusal(
      { ...fixture(), assessment: { ...fixture().assessment, ...override } },
      'UNSUPPORTED_ASSESSMENT',
    );
});

test('malformed trust, lifecycle and source metadata is distinct from unsupported evidence', () => {
  for (const override of [
    { verification: true },
    { verification: 'APPROVED' },
    { lifecycle: 'UNKNOWN' },
    { type: 'TEXT' },
    { purpose: 'MASTERED' },
    { graderId: '' },
    { graderVersion: 0 },
    { attemptNumber: '1' },
    { submissionProvenance: 'a'.repeat(65) },
  ])
    refusal(
      { ...fixture(), assessment: { ...fixture().assessment, ...override } },
      'INVALID_ASSESSMENT',
    );
});

test('known revoked and stale evidence never produces a classification', () => {
  for (const [lifecycle, code] of [
    ['REVOKED', 'REVOKED_ASSESSMENT'],
    ['STALE', 'STALE_ASSESSMENT'],
  ] as const)
    refusal(
      {
        ...fixture(100),
        assessment: { ...fixture(100).assessment, lifecycle },
      },
      code,
    );
});

test('missing assessment and missing or null score are not fabricated zero', () => {
  refusal({ ...fixture(), assessment: null }, 'SCORE_MISSING');
  const assessment: Record<string, unknown> = { ...fixture().assessment };
  delete assessment.score;
  refusal({ ...fixture(), assessment }, 'SCORE_MISSING');
  for (const score of [null, undefined])
    refusal(
      { ...fixture(), assessment: { ...fixture().assessment, score } },
      'SCORE_MISSING',
    );
  classified(fixture(0), 'WEAK');
});

test('nonnumeric, nonfinite and out-of-range scores are never coerced or clamped', () => {
  for (const score of [
    '80',
    '',
    true,
    false,
    NaN,
    Infinity,
    -Infinity,
    -Number.MIN_VALUE,
    -1,
    100.0000001,
    {},
    [],
    [80],
  ])
    refusal(fixture(score), 'INVALID_SCORE');
  refusal(fixture(new Number(80)), 'INVALID_INPUT');
});

test('strict nested schemas reject approval flags, answers and caller selection claims', () => {
  for (const [part, code] of [
    ['expected', 'INVALID_CONTEXT'],
    ['policy', 'INVALID_POLICY'],
    ['assessment', 'INVALID_ASSESSMENT'],
  ] as const) {
    for (const key of [
      'approved',
      'authorId',
      'answer',
      'bestAssessmentId',
      'mastery',
      'completionStatus',
    ]) {
      const input = fixture();
      refusal(
        { ...input, [part]: { ...input[part], [key]: 'private-sentinel' } },
        code,
      );
    }
  }
});

test('unsafe accessors, functions, symbols and proxies are refused without running caller code', () => {
  let calls = 0;
  const getter = Object.defineProperty({}, 'score', {
    enumerable: true,
    get() {
      calls++;
      throw new Error('private');
    },
  });
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        calls++;
        throw new Error('private');
      },
      get() {
        calls++;
        throw new Error('private');
      },
    },
  );
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  for (const score of [
    getter,
    proxy,
    revoked.proxy,
    () => {
      calls++;
    },
    Symbol('private'),
    1n,
  ])
    refusal(fixture(score), 'INVALID_INPUT');
  const input = fixture();
  Object.defineProperty(input.assessment, 'score', {
    enumerable: true,
    get() {
      calls++;
      return 100;
    },
  });
  refusal(input, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('custom prototypes, hidden fields, symbol keys, sparse arrays and cycles are unsafe', () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const hidden = Object.defineProperty({}, 'hidden', { value: 1 });
  const symbol = { [Symbol('private')]: 1 };
  const sparse = new Array(2);
  const array = [80];
  Object.defineProperty(array, 'extra', { value: 1, enumerable: true });
  for (const score of [
    new Date(0),
    new Map(),
    Object.create({ inherited: 1 }),
    cycle,
    hidden,
    symbol,
    sparse,
    array,
  ])
    refusal(fixture(score), 'INVALID_INPUT');
});

test('UTF-8 byte bound includes multibyte and escaped strings before schema parsing', () => {
  // The same invalid score is below the byte limit in ASCII but above it in UTF-8.
  refusal(fixture('a'.repeat(6_000)), 'INVALID_SCORE');
  refusal(fixture('界'.repeat(6_000)), 'INVALID_INPUT');
  refusal(fixture('\n'.repeat(9_000)), 'INVALID_INPUT');
  refusal({ ...fixture(), ignored: 'a'.repeat(16_384) }, 'INVALID_INPUT');
});

test('exact 16 KiB snapshot boundary is accepted for validation and one more byte refuses', () => {
  const base = fixture('');
  const bytes = Buffer.byteLength(JSON.stringify(base), 'utf8');
  refusal(fixture('a'.repeat(16_384 - bytes)), 'INVALID_SCORE');
  refusal(fixture('a'.repeat(16_385 - bytes)), 'INVALID_INPUT');
});

test('total property and depth bounds include nested score and unknown metadata', () => {
  const properties =
    Object.keys(fixture()).length +
    Object.keys(fixture().expected).length +
    Object.keys(fixture().policy).length +
    Object.keys(fixture().assessment).length;
  const score = Object.fromEntries(
    Array.from({ length: 256 - properties }, (_, i) => [`p${i}`, 0]),
  );
  refusal(fixture(score), 'INVALID_SCORE');
  refusal(fixture({ ...score, extra: 0 }), 'INVALID_INPUT');
  refusal(fixture({ a: { b: { c: { d: 0 } } } }), 'INVALID_SCORE');
  refusal(fixture({ a: { b: { c: { d: { e: 0 } } } } }), 'INVALID_INPUT');
});

test('refusal precedence is stable across combined failures and property insertion order', () => {
  const cases: [unknown, MasteryPolicyRefusalCode][] = [];
  const input = () => fixture('invalid-score');
  cases.push([{ ...input(), extra: true, schemaVersion: 2 }, 'INVALID_INPUT']);
  cases.push([
    { ...input(), schemaVersion: 2, expected: null },
    'UNSUPPORTED_VERSION',
  ]);
  cases.push([{ ...input(), expected: null, policy: null }, 'INVALID_CONTEXT']);
  cases.push([{ ...input(), policy: null, assessment: {} }, 'INVALID_POLICY']);
  cases.push([
    {
      ...input(),
      assessment: {
        ...input().assessment,
        userId: '',
        verification: 'UNVERIFIED',
      },
    },
    'INVALID_ASSESSMENT',
  ]);
  cases.push([
    {
      ...input(),
      assessment: {
        ...input().assessment,
        verification: 'UNVERIFIED',
        purpose: 'DIAGNOSTIC',
      },
    },
    'UNTRUSTED_ASSESSMENT',
  ]);
  cases.push([
    {
      ...input(),
      assessment: {
        ...input().assessment,
        purpose: 'DIAGNOSTIC',
        userId: 'a'.repeat(24),
      },
    },
    'UNSUPPORTED_ASSESSMENT',
  ]);
  cases.push([
    {
      ...input(),
      assessment: {
        ...input().assessment,
        userId: 'a'.repeat(24),
        lifecycle: 'REVOKED',
      },
    },
    'BINDING_MISMATCH',
  ]);
  cases.push([
    {
      ...input(),
      assessment: { ...input().assessment, lifecycle: 'REVOKED', score: null },
    },
    'REVOKED_ASSESSMENT',
  ]);
  cases.push([
    {
      ...input(),
      assessment: { ...input().assessment, lifecycle: 'STALE', score: null },
    },
    'STALE_ASSESSMENT',
  ]);
  cases.push([{ ...input(), assessment: null }, 'SCORE_MISSING']);
  cases.push([input(), 'INVALID_SCORE']);
  assert.deepEqual(
    cases.map(([, code]) => code),
    [...masteryPolicyRefusalCodes],
  );
  for (const [value, code] of cases) {
    refusal(value, code);
    refusal(
      Object.fromEntries(Object.entries(value as object).reverse()),
      code,
    );
  }
  refusal(
    { ...fixture(), schemaVersion: 2, ignored: new Proxy({}, {}) },
    'INVALID_INPUT',
  );
});

test('all classifications and refusals return exactly two fields with no sensitive echo', () => {
  const inputs: unknown[] = [
    fixture(0),
    fixture(60),
    fixture(100),
    null,
    fixture('private-sentinel'),
    { ...fixture(), assessment: null },
  ];
  const allowed = new Set(['NONE', ...masteryPolicyRefusalCodes]);
  for (const input of inputs) {
    const result: MasteryPolicyResult = evaluate(input);
    assert.deepEqual(Object.keys(result).sort(), ['classification', 'code']);
    assert.ok(allowed.has(result.code));
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-sentinel|score|userId|rubric|answer|VERIFIED|completion|mastery|certificate|receipt/,
    );
    const again = evaluate(input);
    assert.deepEqual(result, again);
    assert.notEqual(result, again);
  }
});

test('frozen inputs and null prototypes are deterministic and remain unchanged', () => {
  function freeze(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  const input = fixture(70);
  const before = JSON.stringify(input);
  freeze(input);
  for (let i = 0; i < 10; i++) classified(input, 'IMPROVING');
  assert.equal(JSON.stringify(input), before);
  const plain = fixture();
  for (const part of [plain, plain.expected, plain.policy, plain.assessment])
    Object.setPrototypeOf(part, null);
  classified(plain, 'STRONG');
});

test('caller consistency claims cannot establish authenticity or qualify completion', () => {
  const forged = fixture(100);
  forged.expected.userId = forged.assessment.userId = 'a'.repeat(24);
  classified(forged, 'STRONG');
  assert.deepEqual(Object.keys(evaluate(forged)).sort(), [
    'classification',
    'code',
  ]);
  // The utility has no independent authority source. An approval flag is rejected,
  // and a future authenticated adapter must prove every claim before calling it.
  refusal({ ...forged, approved: true }, 'INVALID_INPUT');
});

test('source has no producer/auth/storage imports, I/O, clock, random or hidden integration', () => {
  const source = readFileSync(
    new URL('../src/modules/progress/mastery-policy.ts', import.meta.url),
    'utf8',
  );
  const ast = ts.createSourceFile(
    'mastery-policy.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = ast.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual(imports, ['node:util', 'zod']);
  function walk(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      assert.doesNotMatch(
        node.expression.getText(ast),
        /^(?:console\.|process\.|Date\.|Math\.random|fetch$|setTimeout$|setInterval$|require$|import$)/,
      );
    }
    if (ts.isNewExpression(node))
      assert.notEqual(node.expression.getText(ast), 'Date');
    ts.forEachChild(node, walk);
  }
  walk(ast);
});
