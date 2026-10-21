import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import {
  evaluateOutputGrading as evaluate,
  outputGradingRefusalCodes,
  type OutputGradingInput,
  type OutputGradingRefusalCode,
} from '../src/modules/practice/output-grading.js';

function fixture() {
  return {
    schemaVersion: 1 as const,
    question: {
      id: 'a'.repeat(24),
      conceptId: 'b'.repeat(24),
      type: 'OUTPUT',
      questionRevision: 'c'.repeat(64),
      contentFingerprint: 'd'.repeat(64),
      rubricId: 'synthetic-rubric',
      rubricVersion: 1,
    },
    rubric: {
      schemaVersion: 1 as const,
      id: 'synthetic-rubric',
      version: 1,
      approval: 'APPROVED' as const,
      questionId: 'a'.repeat(24),
      conceptId: 'b'.repeat(24),
      type: 'OUTPUT',
      questionRevision: 'c'.repeat(64),
      contentFingerprint: 'd'.repeat(64),
      answerForm: 'TEXT',
      comparison: 'EXACT_TEXT',
      normalization: 'NONE',
      expectedAnswer: '42',
    },
    studentAnswer: '42',
  } satisfies OutputGradingInput;
}
const correct = { status: 'GRADED', outcome: 'CORRECT', score: 100 };
const incorrect = { status: 'GRADED', outcome: 'INCORRECT', score: 0 };
function without(value: object, key: string) {
  const copy: Record<string, unknown> = { ...value };
  delete copy[key];
  return copy;
}
function refusal(input: unknown, code: OutputGradingRefusalCode) {
  const result = evaluate(input);
  assert.deepEqual(result, { status: 'REFUSED', code });
  assert.equal(Object.hasOwn(result, 'score'), false);
  return result;
}
function comparison(expected: string, submitted: string) {
  const input = fixture();
  input.rubric.expectedAnswer = expected;
  input.studentAnswer = submitted;
  return evaluate(input);
}

test('explicit fully bound synthetic approved exact-text rubric grades a correct literal 100', () => {
  assert.deepEqual(evaluate(fixture()), correct);
});

test('valid literal mismatch grades 0 without returning a pass/completion decision', () => {
  assert.deepEqual(evaluate({ ...fixture(), studentAnswer: '41' }), incorrect);
});

test('spaces, tabs, indentation, newlines and casing remain significant', () => {
  for (const text of [
    ' 42',
    '42 ',
    '\t42',
    '42\t',
    '\n42',
    '42\n',
    '42\r',
    '42\r\n',
    '4 2',
    '4\t2',
    '4\n2',
  ]) {
    assert.deepEqual(comparison(text, text), correct);
    assert.deepEqual(comparison('42', text), incorrect);
    assert.deepEqual(comparison(text, '42'), incorrect);
  }
  assert.deepEqual(comparison('Hello', 'hello'), incorrect);
  assert.deepEqual(comparison('a\r\nb', 'a\nb'), incorrect);
  assert.deepEqual(comparison('a\rb', 'a\nb'), incorrect);
});

test('no Unicode, number, Markdown, code-fence or HTML canonicalization occurs', () => {
  for (const [expected, submitted] of [
    ['é', 'e\u0301'],
    ['42', '042'],
    ['42', '42.0'],
    ['42', '`42`'],
    ['42', '```text\n42\n```'],
    ['<b>42</b>', '42'],
    ['😀', '😃'],
  ])
    assert.deepEqual(comparison(expected!, submitted!), incorrect);
  assert.deepEqual(comparison('😀', '😀'), correct);
});

test('accepted length boundaries count UTF-16 units without truncation', () => {
  for (const value of ['x', 'x'.repeat(10_000), '😀'.repeat(5000)])
    assert.deepEqual(comparison(value, value), correct);
});

test('invalid student answers refuse without numeric scores', () => {
  for (const studentAnswer of [
    '',
    ' \t\r\n',
    '\u00a0\ufeff',
    'x'.repeat(10_001),
    '😀'.repeat(5000) + 'x',
    '\ud800',
    '\udfff',
    'x\ud800x',
    null,
    undefined,
    42,
    false,
    NaN,
    {},
    [],
    ['42'],
  ])
    refusal({ ...fixture(), studentAnswer }, 'INVALID_ANSWER');
});

test('invalid or ambiguous expected answers refuse as rubrics, not incorrect grades', () => {
  for (const expectedAnswer of [
    '',
    ' \t\n',
    'x'.repeat(10_001),
    '\ud800',
    '\udfff',
    'x\ud800x',
    null,
    undefined,
    42,
    true,
    ['42', '43'],
    {},
  ]) {
    const input = fixture();
    refusal(
      { ...input, rubric: { ...input.rubric, expectedAnswer } },
      'INVALID_RUBRIC',
    );
  }
});

test('missing root or expected binding context never produces a grade', () => {
  const input = fixture();
  for (const key of Object.keys(input))
    refusal(without(input, key), 'INVALID_INPUT');
  for (const key of Object.keys(input.question))
    refusal(
      { ...input, question: without(input.question, key) },
      'INVALID_INPUT',
    );
  for (const value of [undefined, null, false, '42', [], {}])
    refusal(value, 'INVALID_INPUT');
});

test('all rubric fields including opt-in approval and normalization are required', () => {
  const input = fixture();
  for (const key of Object.keys(input.rubric))
    refusal({ ...input, rubric: without(input.rubric, key) }, 'INVALID_RUBRIC');
  for (const rubric of [undefined, null, [], '42', 1, {}])
    refusal({ ...input, rubric }, 'INVALID_RUBRIC');
});

test('unknown fields cannot inject authorization, alternative solutions or policy', () => {
  const input = fixture();
  for (const key of ['authorized', 'userId', 'studentAnswer2', 'minimumScore'])
    refusal({ ...input, [key]: true }, 'INVALID_INPUT');
  refusal(
    { ...input, question: { ...input.question, approved: true } },
    'INVALID_INPUT',
  );
  for (const key of [
    'alternatives',
    'answer',
    'evaluation',
    'verified',
    'rubricSource',
  ])
    refusal(
      { ...input, rubric: { ...input.rubric, [key]: 'secret' } },
      'INVALID_RUBRIC',
    );
});

test('canonical lowercase identities and strict digest/token/version shapes are enforced', () => {
  const input = fixture();
  for (const [key, value] of [
    ['id', 'A'.repeat(24)],
    ['conceptId', 'b'.repeat(23)],
    ['questionRevision', 'c'.repeat(64) + '\n'],
    ['contentFingerprint', 'D'.repeat(64)],
    ['rubricId', 'bad token'],
    ['rubricId', 'a'.repeat(129)],
    ['rubricVersion', 0],
    ['rubricVersion', 1.5],
    ['rubricVersion', '1'],
    ['rubricVersion', Number.MAX_SAFE_INTEGER + 1],
  ] as const)
    refusal(
      { ...input, question: { ...input.question, [key]: value } },
      'INVALID_INPUT',
    );
  for (const [key, value] of [
    ['id', 'bad token'],
    ['questionId', 'a'.repeat(23)],
    ['conceptId', 'B'.repeat(24)],
    ['questionRevision', 'bad'],
    ['contentFingerprint', 'D'.repeat(64)],
    ['version', 0],
    ['version', 1.5],
    ['version', '1'],
    ['version', Infinity],
    ['approval', true],
    ['approval', 'approved'],
  ] as const)
    refusal(
      { ...input, rubric: { ...input.rubric, [key]: value } },
      'INVALID_RUBRIC',
    );
});

test('schema versions are explicit and unsupported versions refuse before grading', () => {
  const input = fixture();
  for (const schemaVersion of [0, 2, '1', null, undefined, NaN]) {
    refusal({ ...input, schemaVersion }, 'UNSUPPORTED_VERSION');
    refusal(
      { ...input, rubric: { ...input.rubric, schemaVersion } },
      'UNSUPPORTED_VERSION',
    );
  }
});

test('draft and revoked rubrics refuse; approval is metadata rather than authority', () => {
  const input = fixture();
  for (const approval of ['DRAFT', 'REVOKED'])
    refusal(
      { ...input, rubric: { ...input.rubric, approval } },
      'RUBRIC_NOT_APPROVED',
    );
  // Synthetic callers supply metadata; the primitive makes no authenticity claim.
  assert.deepEqual(evaluate(input), correct);
  assert.deepEqual(Object.keys(evaluate(input)).sort(), [
    'outcome',
    'score',
    'status',
  ]);
});

test('other question types cannot be implicitly graded on either side', () => {
  const input = fixture();
  for (const type of ['DESCRIPTIVE', 'SCENARIO', 'CODING', 'UNKNOWN']) {
    refusal(
      { ...input, question: { ...input.question, type } },
      'UNSUPPORTED_RUBRIC',
    );
    refusal(
      { ...input, rubric: { ...input.rubric, type } },
      'UNSUPPORTED_RUBRIC',
    );
  }
});

test('strategies must be explicit recognized literals, never coercions or implicit defaults', () => {
  const input = fixture();
  for (const [key, value] of [
    ['answerForm', 'NUMBER'],
    ['answerForm', 'JSON'],
    ['comparison', 'REGEX'],
    ['comparison', 'EXACT_TEXT_IGNORE_CASE'],
    ['normalization', 'TRIM'],
    ['normalization', 'LF'],
    ['normalization', 'NFC'],
    ['normalization', 'none'],
  ])
    refusal(
      { ...input, rubric: { ...input.rubric, [key!]: value } },
      'UNSUPPORTED_RUBRIC',
    );
  for (const key of ['answerForm', 'comparison', 'normalization'])
    for (const value of ['', null, true, 0])
      refusal(
        { ...input, rubric: { ...input.rubric, [key]: value } },
        'INVALID_RUBRIC',
      );
});

test('each binding must match before even a correct answer can be compared', () => {
  const input = fixture();
  for (const [key, value] of [
    ['questionId', 'e'.repeat(24)],
    ['conceptId', 'f'.repeat(24)],
    ['questionRevision', 'e'.repeat(64)],
    ['contentFingerprint', 'f'.repeat(64)],
    ['id', 'different-rubric'],
    ['version', 2],
  ] as const) {
    const result = refusal(
      { ...input, rubric: { ...input.rubric, [key]: value } },
      'BINDING_MISMATCH',
    );
    assert.equal(
      JSON.stringify(result).includes(input.rubric.expectedAnswer),
      false,
    );
  }
});

test('valid matching rubric versions are explicit, not latest-version inference', () => {
  const input = fixture();
  assert.deepEqual(
    evaluate({
      ...input,
      question: { ...input.question, rubricVersion: Number.MAX_SAFE_INTEGER },
      rubric: { ...input.rubric, version: Number.MAX_SAFE_INTEGER },
    }),
    correct,
  );
});

test('refusal precedence is stable across simultaneous independent defects', () => {
  const input = fixture();
  const bad = {
    ...input,
    studentAnswer: '',
    rubric: {
      ...input.rubric,
      approval: 'REVOKED',
      id: 'different',
      comparison: 'REGEX',
    },
  };
  refusal(bad, 'UNSUPPORTED_RUBRIC');
  refusal({ ...bad, schemaVersion: 2 }, 'UNSUPPORTED_VERSION');
  refusal({ ...bad, schemaVersion: 2, extra: true }, 'INVALID_INPUT');
  refusal(
    { ...bad, rubric: { ...bad.rubric, schemaVersion: 2, expectedAnswer: '' } },
    'UNSUPPORTED_VERSION',
  );
  refusal(
    { ...bad, rubric: { ...bad.rubric, expectedAnswer: '' } },
    'INVALID_RUBRIC',
  );
  refusal(
    { ...bad, rubric: { ...bad.rubric, comparison: 'EXACT_TEXT' } },
    'RUBRIC_NOT_APPROVED',
  );
  refusal(
    { ...bad, rubric: { ...input.rubric, id: 'different' } },
    'BINDING_MISMATCH',
  );
  refusal({ ...input, studentAnswer: '' }, 'INVALID_ANSWER');
});

test('refusals contain only fixed code/status and never sensitive context or scores', () => {
  const input = fixture();
  input.rubric.expectedAnswer = 'PRIVATE_EXPECTED_LITERAL';
  input.studentAnswer = 'PRIVATE_STUDENT_LITERAL';
  const result = refusal(
    { ...input, rubric: { ...input.rubric, approval: 'REVOKED' } },
    'RUBRIC_NOT_APPROVED',
  );
  assert.deepEqual(Object.keys(result).sort(), ['code', 'status']);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
  assert.equal(
    JSON.stringify(result).includes(input.question.contentFingerprint),
    false,
  );
  assert.deepEqual(outputGradingRefusalCodes, [
    'INVALID_INPUT',
    'UNSUPPORTED_VERSION',
    'INVALID_RUBRIC',
    'UNSUPPORTED_RUBRIC',
    'RUBRIC_NOT_APPROVED',
    'BINDING_MISMATCH',
    'INVALID_ANSWER',
  ]);
});

test('accessors, callbacks and proxy traps never execute at any input depth', () => {
  const input = fixture();
  let calls = 0;
  const getter = () => {
    calls++;
    return '42';
  };
  for (const value of [
    Object.defineProperty({ ...input }, 'studentAnswer', {
      get: getter,
      enumerable: true,
    }),
    {
      ...input,
      rubric: Object.defineProperty({ ...input.rubric }, 'expectedAnswer', {
        get: getter,
        enumerable: true,
      }),
    },
    new Proxy(input, {
      getPrototypeOf() {
        calls++;
        throw new Error();
      },
      ownKeys() {
        calls++;
        throw new Error();
      },
    }),
    {
      ...input,
      studentAnswer: new Proxy(
        {},
        {
          ownKeys() {
            calls++;
            throw new Error();
          },
        },
      ),
    },
    { ...input, studentAnswer: getter },
  ])
    refusal(value, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('unsafe object graphs and bounds refuse without conversion side effects', () => {
  const input = fixture();
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const value of [
    { ...input, studentAnswer: cyclic },
    { ...input, studentAnswer: { a: { b: { c: { d: '42' } } } } },
    {
      ...input,
      studentAnswer: Object.fromEntries(
        Array.from({ length: 33 }, (_, i) => ['x' + i, true]),
      ),
    },
    { ...input, studentAnswer: new Date() },
    { ...input, studentAnswer: Object(42) },
    { ...input, studentAnswer: new Array(2) },
    { ...input, studentAnswer: [1n] },
    { ...input, [Symbol('private')]: true },
    Object.defineProperty({ ...input }, 'private', { value: true }),
  ])
    refusal(value, 'INVALID_INPUT');
});

test('null-prototype data and frozen inputs remain unmodified and repeatable', () => {
  const input = fixture();
  const before = JSON.stringify(input);
  Object.freeze(input.question);
  Object.freeze(input.rubric);
  Object.freeze(input);
  const first = evaluate(input);
  for (let i = 0; i < 10; i++) {
    const next = evaluate(input);
    assert.deepEqual(next, first);
    assert.notEqual(next, first);
  }
  assert.deepEqual(first, correct);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(
    evaluate(Object.assign(Object.create(null), input)),
    correct,
  );
});

test('module imports no persistence, account, policy, execution or infrastructure dependency', () => {
  const source = ts.createSourceFile(
    'output-grading.ts',
    readFileSync(
      new URL('../src/modules/practice/output-grading.ts', import.meta.url),
      'utf8',
    ),
    ts.ScriptTarget.Latest,
    true,
  );
  const imports = source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)
    .sort();
  assert.deepEqual(imports, ['node:util', 'zod']);
});
