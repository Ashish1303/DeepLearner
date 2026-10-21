import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import {
  verifyVisualizationCheckpoint as verify,
  visualizationCheckpointRefusalCodes,
  type VisualizationCheckpointInput,
  type VisualizationCheckpointRefusalCode,
} from '../src/modules/visualizations/checkpoint-verification.js';

function fixture() {
  const binding = {
    conceptId: 'a'.repeat(24),
    visualizationId: 'b'.repeat(24),
    conceptRevision: 'concept-v1',
    visualizationRevision: 'visual-v1',
    checkpointId: 'retained-environment',
    checkpointVersion: 1,
    policyId: 'visual-interaction',
    policyVersion: 1,
  };
  return {
    schemaVersion: 1 as const,
    expected: { ...binding },
    definition: {
      ...binding,
      responseType: 'SINGLE_CHOICE',
      choices: [
        { id: 'retained', label: 'Retained lexical environment' },
        { id: 'discarded', label: 'Discarded call frame' },
      ],
      expectedChoiceId: 'retained',
    },
    response: {
      ...binding,
      responseType: 'SINGLE_CHOICE',
      selectedChoiceId: 'retained',
    },
  } satisfies VisualizationCheckpointInput;
}
const correct = {
  status: 'EVALUATED',
  outcome: 'CORRECT',
  code: null,
  completionQualification: 'NOT_ESTABLISHED',
};
const incorrect = { ...correct, outcome: 'INCORRECT' };
function refusal(input: unknown, code: VisualizationCheckpointRefusalCode) {
  const result = verify(input);
  assert.deepEqual(result, {
    status: 'REFUSED',
    outcome: null,
    code,
    completionQualification: 'NOT_ESTABLISHED',
  });
  return result;
}
function without(value: object, key: string) {
  const result: Record<string, unknown> = { ...value };
  delete result[key];
  return result;
}
const parts = ['expected', 'definition', 'response'] as const;
function bind<K extends keyof VisualizationCheckpointInput['expected']>(
  input: ReturnType<typeof fixture>,
  key: K,
  value: VisualizationCheckpointInput['expected'][K],
) {
  for (const part of parts) input[part][key] = value;
}

test('explicit fully bound single-choice response compares correctly without qualifying completion', () => {
  assert.deepEqual(verify(fixture()), correct);
});

test('valid wrong choice is INCORRECT rather than refused or scored', () => {
  const input = fixture();
  input.response.selectedChoiceId = 'discarded';
  assert.deepEqual(verify(input), incorrect);
});

test('choice ids are exact: spaces, case, Unicode variants and coercible values never normalize', () => {
  for (const selectedChoiceId of [
    ' retained',
    'retained ',
    'Retained',
    'retained\n',
    'ｒetained',
    0,
    true,
    { toString: () => 'retained' },
  ]) {
    const input = fixture();
    refusal(
      { ...input, response: { ...input.response, selectedChoiceId } },
      typeof selectedChoiceId === 'object'
        ? 'INVALID_INPUT'
        : 'INVALID_RESPONSE',
    );
  }
});

test('comparison uses choice identity rather than ordering, ordinal or label', () => {
  const input = fixture();
  input.definition.choices.reverse();
  assert.deepEqual(verify(input), correct);
  input.response.selectedChoiceId = 'retained-lexical-environment';
  refusal(input, 'INVALID_SELECTION');
  input.response.selectedChoiceId = '0';
  refusal(input, 'INVALID_RESPONSE');
});

test('two through eight choices and first/last correct choices are supported', () => {
  for (const length of [2, 8]) {
    const input = fixture();
    input.definition.choices = Array.from({ length }, (_, i) => ({
      id: `choice-${i}`,
      label: `Textual choice ${i}`,
    }));
    for (const index of [0, length - 1]) {
      input.definition.expectedChoiceId = `choice-${index}`;
      input.response.selectedChoiceId = `choice-${index}`;
      assert.deepEqual(verify(input), correct);
    }
  }
});

test('all root fields are required and unknown root fields refuse', () => {
  const input = fixture();
  for (const key of Object.keys(input))
    refusal(without(input, key), 'INVALID_INPUT');
  refusal({ ...input, approved: true }, 'INVALID_INPUT');
});

test('malformed versions refuse as input while other positive safe versions are unsupported', () => {
  for (const schemaVersion of [0, -1, 1.5, '1', null, undefined, NaN, Infinity])
    refusal({ ...fixture(), schemaVersion }, 'INVALID_INPUT');
  for (const schemaVersion of [2, Number.MAX_SAFE_INTEGER])
    refusal({ ...fixture(), schemaVersion }, 'UNSUPPORTED_VERSION');
});

test('every missing binding field refuses at its own validation stage', () => {
  for (const part of parts)
    for (const key of Object.keys(fixture().expected)) {
      const input = fixture();
      refusal(
        { ...input, [part]: without(input[part], key) },
        part === 'expected'
          ? 'INVALID_CONTEXT'
          : part === 'definition'
            ? 'INVALID_DEFINITION'
            : 'INVALID_RESPONSE',
      );
    }
});

test('canonical ObjectIds reject coercion, uppercase, whitespace and malformed lengths', () => {
  for (const key of ['conceptId', 'visualizationId'])
    for (const value of [
      'A'.repeat(24),
      'a'.repeat(23),
      'a'.repeat(25),
      'x'.repeat(24),
      'a'.repeat(24) + '\n',
      123,
      null,
    ]) {
      const input = fixture();
      refusal(
        { ...input, expected: { ...input.expected, [key]: value } },
        'INVALID_CONTEXT',
      );
    }
});

test('revision and policy tokens enforce exact syntax and length', () => {
  for (const key of [
    'conceptRevision',
    'visualizationRevision',
    'checkpointId',
    'policyId',
  ] as const) {
    for (const value of ['', ' x', 'x ', 'x\n', '_x', 'é', 'x'.repeat(129)]) {
      const input = fixture();
      input.expected[key] = value;
      refusal(input, 'INVALID_CONTEXT');
    }
    for (const value of ['x', 'X._:-9', 'x'.repeat(128)]) {
      const input = fixture();
      bind(input, key, value);
      assert.deepEqual(verify(input), correct);
    }
  }
});

test('checkpoint and policy versions are positive safe integers without defaulting', () => {
  for (const key of ['checkpointVersion', 'policyVersion'] as const) {
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Infinity]) {
      const input = fixture();
      input.expected[key] = value;
      refusal(input, 'INVALID_CONTEXT');
    }
    const input = fixture();
    bind(input, key, Number.MAX_SAFE_INTEGER);
    assert.deepEqual(verify(input), correct);
  }
});

test('every well-formed binding mismatch refuses before comparison in all three projections', () => {
  const alternate = {
    conceptId: 'c'.repeat(24),
    visualizationId: 'd'.repeat(24),
    conceptRevision: 'concept-v2',
    visualizationRevision: 'visual-v2',
    checkpointId: 'different-checkpoint',
    checkpointVersion: 2,
    policyId: 'different-policy',
    policyVersion: 2,
  };
  for (const part of parts)
    for (const [key, value] of Object.entries(alternate)) {
      const input = fixture();
      refusal(
        { ...input, [part]: { ...input[part], [key]: value } },
        'BINDING_MISMATCH',
      );
    }
});

test('unknown selected ids refuse while another authored id is a valid incorrect outcome', () => {
  const input = fixture();
  input.response.selectedChoiceId = 'unknown';
  refusal(input, 'INVALID_SELECTION');
  input.response.selectedChoiceId = 'discarded';
  assert.deepEqual(verify(input), incorrect);
});

test('missing, nonarray, too few and oversized choice sets never evaluate', () => {
  const input = fixture();
  for (const choices of [
    null,
    {},
    'retained',
    [],
    [input.definition.choices[0]],
  ])
    refusal(
      { ...input, definition: { ...input.definition, choices } },
      'INVALID_DEFINITION',
    );
  refusal(
    { ...input, definition: without(input.definition, 'choices') },
    'INVALID_DEFINITION',
  );
  refusal(
    {
      ...input,
      definition: {
        ...input.definition,
        choices: Array.from({ length: 9 }, (_, i) => ({
          id: `choice-${i}`,
          label: `Choice ${i}`,
        })),
      },
    },
    'INVALID_INPUT',
  );
});

test('duplicate ids, equal labels and contradictory expected choices invalidate the definition', () => {
  for (const field of ['id', 'label'] as const) {
    const input = fixture();
    input.definition.choices[1]![field] = input.definition.choices[0]![field];
    refusal(input, 'INVALID_DEFINITION');
  }
  const input = fixture();
  for (const expectedChoiceId of [
    'unknown',
    '',
    'Retained',
    null,
    ['retained'],
  ])
    refusal(
      { ...input, definition: { ...input.definition, expectedChoiceId } },
      'INVALID_DEFINITION',
    );
});

test('choice ids and labels enforce their inclusive bounds and inert text stays unchanged', () => {
  const input = fixture();
  const id = 'a'.repeat(64);
  input.definition.choices[0] = { id, label: '😀'.repeat(120) };
  input.definition.expectedChoiceId = id;
  input.response.selectedChoiceId = id;
  assert.deepEqual(verify(input), correct);
  input.definition.choices[0]!.label += 'x';
  refusal(input, 'INVALID_DEFINITION');
  for (const badId of ['a'.repeat(65), '', 'A', 'x\n']) {
    const next = fixture();
    next.definition.choices[0]!.id = badId;
    refusal(next, 'INVALID_DEFINITION');
  }
  const next = fixture();
  next.definition.choices[0]!.label = ' <script>inert text</script> ';
  assert.deepEqual(verify(next), correct);
});

test('blank, control-character and malformed Unicode labels refuse', () => {
  for (const label of [
    '',
    ' ',
    '\u00a0\ufeff',
    'a\nb',
    'a\tb',
    '\0',
    '\u007f',
    '\u0080',
    '\u009f',
    '\ud800',
    '\udfff',
    'x\ud800x',
  ]) {
    const input = fixture();
    input.definition.choices[0]!.label = label;
    refusal(input, 'INVALID_DEFINITION');
  }
});

test('well-formed Unicode labels are not normalized and do not constitute semantic approval', () => {
  const input = fixture();
  input.definition.choices = [
    { id: 'retained', label: 'é' },
    { id: 'discarded', label: 'e\u0301' },
  ];
  assert.deepEqual(verify(input), correct);
  assert.equal(input.definition.choices[1]!.label, 'e\u0301');
});

test('unsupported response formats refuse even when both claims agree', () => {
  for (const responseType of [
    'MULTIPLE_CHOICE',
    'TEXT',
    'PLAYBACK_COMPLETE',
    'single_choice',
  ]) {
    for (const part of ['definition', 'response'] as const) {
      const input = fixture();
      input[part].responseType = responseType;
      refusal(input, 'UNSUPPORTED_RESPONSE_TYPE');
    }
    const input = fixture();
    input.definition.responseType = input.response.responseType = responseType;
    refusal(input, 'UNSUPPORTED_RESPONSE_TYPE');
  }
});

test('lifecycle metadata is outside the approved schema and never silently ignored', () => {
  for (const [key, value] of Object.entries({
    issuedAtMs: 0,
    expiresAtMs: NaN,
    revokedAtMs: -1,
    asOfMs: 1,
    expired: false,
    revoked: false,
  }))
    for (const part of parts) {
      const input = fixture();
      refusal(
        { ...input, [part]: { ...input[part], [key]: value } },
        part === 'expected'
          ? 'INVALID_CONTEXT'
          : part === 'definition'
            ? 'INVALID_DEFINITION'
            : 'INVALID_RESPONSE',
      );
    }
});

test('exactly one choice is required and response cannot supply the authoritative answer', () => {
  for (const selectedChoiceId of [
    null,
    undefined,
    [],
    ['retained'],
    ['retained', 'discarded'],
    '',
    1,
  ]) {
    const input = fixture();
    refusal(
      { ...input, response: { ...input.response, selectedChoiceId } },
      'INVALID_RESPONSE',
    );
  }
  const input = fixture();
  refusal(
    { ...input, response: without(input.response, 'selectedChoiceId') },
    'INVALID_RESPONSE',
  );
  refusal(
    {
      ...input,
      response: { ...input.response, expectedChoiceId: 'discarded' },
    },
    'INVALID_RESPONSE',
  );
});

test('caller approval, identity, replay and completion flags are not accepted as authorization', () => {
  for (const part of parts)
    for (const [key, value] of Object.entries({
      approved: true,
      userId: 'c'.repeat(24),
      authenticated: true,
      challengeId: 'claim',
      consumed: false,
      completionQualification: 'VERIFIED',
    })) {
      const input = fixture();
      refusal(
        { ...input, [part]: { ...input[part], [key]: value } },
        part === 'expected'
          ? 'INVALID_CONTEXT'
          : part === 'definition'
            ? 'INVALID_DEFINITION'
            : 'INVALID_RESPONSE',
      );
    }
});

test('strict choice objects and response fields reject arbitrary metadata', () => {
  const input = fixture();
  refusal(
    {
      ...input,
      definition: {
        ...input.definition,
        choices: [
          { ...input.definition.choices[0], correct: true },
          input.definition.choices[1],
        ],
      },
    },
    'INVALID_DEFINITION',
  );
  refusal(
    {
      ...input,
      response: { ...input.response, selectedChoiceIds: ['retained'] },
    },
    'INVALID_RESPONSE',
  );
});

test('invalid root values, primitive nested data and class instances fail closed', () => {
  for (const value of [
    null,
    undefined,
    true,
    1,
    'input',
    [],
    new Date(),
    new Map(),
    1n,
  ])
    refusal(value, 'INVALID_INPUT');
  for (const value of [null, true, 1, 'context', []])
    refusal({ ...fixture(), expected: value }, 'INVALID_CONTEXT');
});

test('getters and conversion callbacks do not run, even in otherwise unreachable fields', () => {
  let calls = 0;
  const input = fixture();
  Object.defineProperty(input.definition, 'expectedChoiceId', {
    enumerable: true,
    get() {
      calls++;
      return 'retained';
    },
  });
  refusal(input, 'INVALID_INPUT');
  const value = {
    ...fixture(),
    ignored: {
      valueOf() {
        calls++;
        return 1;
      },
      toString() {
        calls++;
        return 'retained';
      },
    },
  };
  refusal(value, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('proxies and revoked proxies refuse without invoking any traps', () => {
  let calls = 0;
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        calls++;
        throw new Error('secret');
      },
      getPrototypeOf() {
        calls++;
        throw new Error('secret');
      },
      get() {
        calls++;
        throw new Error('secret');
      },
    },
  );
  refusal(proxy, 'INVALID_INPUT');
  refusal({ ...fixture(), definition: proxy }, 'INVALID_INPUT');
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  refusal(revoked.proxy, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('cycles, executable values and custom prototypes refuse without mutation', () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  for (const value of [
    cyclic,
    () => 'retained',
    Symbol('secret'),
    Object.create({ approved: true }),
  ])
    refusal({ ...fixture(), ignored: value }, 'INVALID_INPUT');
});

test('sparse, accessor, inherited and extra-property arrays refuse', () => {
  const choices = fixture().definition.choices;
  const sparse = [...choices];
  delete sparse[0];
  const extra = Object.assign([...choices], { ignored: true });
  const inherited = [...choices];
  Object.setPrototypeOf(inherited, null);
  let calls = 0;
  const accessor = [...choices];
  Object.defineProperty(accessor, '0', {
    enumerable: true,
    get() {
      calls++;
      return choices[0];
    },
  });
  for (const value of [sparse, extra, inherited, accessor]) {
    const input = fixture();
    refusal(
      { ...input, definition: { ...input.definition, choices: value } },
      'INVALID_INPUT',
    );
  }
  assert.equal(calls, 0);
});

test('symbol and hidden object keys fail safe inspection rather than being discarded', () => {
  const hidden = fixture();
  Object.defineProperty(hidden.response, 'ignored', { value: 'secret' });
  refusal(hidden, 'INVALID_INPUT');
  refusal(
    Object.assign(fixture(), { [Symbol('secret')]: true }),
    'INVALID_INPUT',
  );
});

test('global depth, keys, array, aggregate-string and visited-value limits refuse', () => {
  let deep: unknown = null;
  for (let i = 0; i < 7; i++) deep = { child: deep };
  const wide = Object.fromEntries(
    Array.from({ length: 33 }, (_, i) => [`key-${i}`, 1]),
  );
  const many = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 1)),
  );
  for (const ignored of [
    deep,
    wide,
    many,
    'x'.repeat(16_385),
    { ['x'.repeat(16_385)]: 1 },
  ])
    refusal({ ...fixture(), ignored }, 'INVALID_INPUT');
});

test('refusal precedence is stable for all adjacent stages and global hazards dominate', () => {
  const cases: [unknown, VisualizationCheckpointRefusalCode][] = [];
  const a = fixture();
  cases.push([{ ...a, extra: true, schemaVersion: 2 }, 'INVALID_INPUT']);
  cases.push([
    { ...a, schemaVersion: 2, expected: null },
    'UNSUPPORTED_VERSION',
  ]);
  cases.push([{ ...a, expected: null, definition: null }, 'INVALID_CONTEXT']);
  cases.push([
    { ...a, definition: null, response: null },
    'INVALID_DEFINITION',
  ]);
  const b = fixture();
  b.definition.responseType = 'TEXT';
  cases.push([{ ...b, response: null }, 'INVALID_RESPONSE']);
  const c = fixture();
  c.definition.responseType = 'TEXT';
  c.response.checkpointVersion = 2;
  cases.push([c, 'UNSUPPORTED_RESPONSE_TYPE']);
  const d = fixture();
  d.response.checkpointVersion = 2;
  d.response.selectedChoiceId = 'unknown';
  cases.push([d, 'BINDING_MISMATCH']);
  const e = fixture();
  e.response.selectedChoiceId = 'unknown';
  cases.push([e, 'INVALID_SELECTION']);
  assert.deepEqual(
    cases.map(([, code]) => code),
    [...visualizationCheckpointRefusalCodes],
  );
  for (const [value, code] of cases) {
    refusal(value, code);
    const root = value as Record<string, unknown>;
    refusal(Object.fromEntries(Object.entries(root).reverse()), code);
  }
  const unsafe = { ...fixture(), schemaVersion: 2, ignored: new Proxy({}, {}) };
  refusal(unsafe, 'INVALID_INPUT');
});

test('all result variants have exactly four public fields and never echo expected content', () => {
  const input = fixture();
  const results = [verify(input)];
  input.response.selectedChoiceId = 'discarded';
  results.push(verify(input));
  input.response.selectedChoiceId = 'unknown';
  results.push(verify(input));
  for (const result of results) {
    assert.deepEqual(Object.keys(result).sort(), [
      'code',
      'completionQualification',
      'outcome',
      'status',
    ]);
    assert.equal(result.completionQualification, 'NOT_ESTABLISHED');
    assert.doesNotMatch(
      JSON.stringify(result),
      /retained|discarded|lexical|expectedChoiceId|score|VERIFIED|certificate|receipt/,
    );
  }
});

test('deeply frozen ordinary and null-prototype inputs stay unchanged across repeated calls', () => {
  function freeze(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  const input = fixture();
  const before = JSON.stringify(input);
  freeze(input);
  for (let i = 0; i < 10; i++) assert.deepEqual(verify(input), correct);
  assert.equal(JSON.stringify(input), before);
  const plain = fixture();
  for (const part of parts) Object.setPrototypeOf(plain[part], null);
  Object.setPrototypeOf(plain, null);
  assert.deepEqual(verify(plain), correct);
});

test('a forged definition can compare correctly but never proves authority or authentic evidence', () => {
  const input = fixture();
  input.definition.expectedChoiceId = input.response.selectedChoiceId =
    'discarded';
  assert.deepEqual(verify(input), correct);
  assert.equal(verify(input).completionQualification, 'NOT_ESTABLISHED');
});

test('source imports are limited to pure validation/inspection and cannot integrate existing producers', () => {
  const source = readFileSync(
    new URL(
      '../src/modules/visualizations/checkpoint-verification.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const ast = ts.createSourceFile(
    'checkpoint-verification.ts',
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
      const callee = node.expression.getText(ast);
      assert.doesNotMatch(
        callee,
        /^(?:console\.|process\.|Date\.|Math\.random|fetch$|setTimeout$|setInterval$|require$|import$)/,
      );
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
});
