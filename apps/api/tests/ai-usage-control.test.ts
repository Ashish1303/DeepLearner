import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { AiUsageInput } from '../src/modules/ai/ai-usage-control.schema.js';
import type { AiUsageRefusalCode } from '../src/modules/ai/ai-usage-control.policy.js';

let propose: typeof import('../src/modules/ai/ai-usage-control.policy.js').proposeAiUsageReservation;
let validate: typeof import('../src/modules/ai/ai-usage-control.schema.js').validateAiUsageInput;
let timeAt: typeof import('../src/modules/ai/ai-usage-control.schema.js').aiUsageTimeAt;
const effects: string[] = [];
try {
  function forbidden() {
    effects.push('FORBIDDEN_EFFECT');
    throw new Error('PRIVATE_CANARY');
  }
  mock.method(net, 'connect', forbidden);
  mock.method(net, 'createConnection', forbidden);
  mock.method(net, 'createServer', forbidden);
  mock.method(net.Socket.prototype, 'connect', forbidden);
  mock.method(net.Server.prototype, 'listen', forbidden);
  mock.method(tls, 'connect', forbidden);
  mock.method(http, 'request', forbidden);
  mock.method(http, 'get', forbidden);
  mock.method(https, 'request', forbidden);
  mock.method(https, 'get', forbidden);
  mock.method(dgram, 'createSocket', forbidden);
  for (const method of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ] as const)
    mock.method(childProcess, method, forbidden);
  mock.method(globalThis, 'fetch', forbidden);
  syncBuiltinESMExports();
  const policy = await import('../src/modules/ai/ai-usage-control.policy.js');
  const schema = await import('../src/modules/ai/ai-usage-control.schema.js');
  propose = policy.proposeAiUsageReservation;
  validate = schema.validateAiUsageInput;
  timeAt = schema.aiUsageTimeAt;
} finally {
  mock.restoreAll();
  syncBuiltinESMExports();
}

// Synthetic supplied facts only. No stored account, real quote or admission.
const instant = Date.parse('2026-11-06T06:50:00.000Z');
function fixture(): AiUsageInput {
  return {
    schemaVersion: 1,
    budgetScope: 'SHARED_AI_TESTING',
    actorId: 'a'.repeat(24),
    operationId: '11111111-1111-4111-8111-111111111111',
    purpose: 'CURRICULUM_OUTLINE',
    periodKey: '2026-11',
    quote: {
      id: '22222222-2222-4222-8222-222222222222',
      periodKey: '2026-11',
      worstCasePaise: 100,
    },
    requestBounds: {
      instructionBytes: 1,
      inputJsonBytes: 2,
      maxOutputBytes: 65536,
      maxOutputTokens: 4096,
      budgetMs: 10000,
    },
    usage: {
      settledPaise: 0,
      reservedPaise: 0,
      unresolvedPriorPaise: 0,
      openOperations: 0,
      actorWindowUsed: 0,
      frozen: false,
    },
  };
}
function refuses(input: unknown, code: AiUsageRefusalCode = 'INVALID_INPUT') {
  assert.deepEqual(propose(input, instant), {
    ok: false,
    error: { code, message: 'AI request cannot be admitted' },
  });
}
function safeError(error: unknown) {
  assert(error instanceof Error);
  assert.equal(error.constructor, Error);
  assert.equal(error.message, 'Invalid AI usage input');
  assert.equal(error.cause, undefined);
  assert.deepEqual(Object.keys(error), []);
  return true;
}

test('first imports are inert and expose no provider/database/startup capability', () => {
  assert.deepEqual(effects, []);
  for (const [file, imports] of [
    ['ai-usage-control.schema.ts', ['node:util', 'zod']],
    ['ai-usage-control.policy.ts', ['./ai-usage-control.schema.js']],
  ] as const) {
    const source = readFileSync(
      new URL(`../src/modules/ai/${file}`, import.meta.url),
      'utf8',
    );
    const tree = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    const actual: string[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        actual.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node)) {
        assert.notEqual(node.expression.kind, ts.SyntaxKind.ImportKeyword);
        assert.notEqual(node.expression.getText(tree), 'require');
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.deepEqual(actual, imports);
    assert.doesNotMatch(
      source,
      /\b(?:process|fetch|setTimeout|setInterval|console|performance)\s*\.|\b(?:fetch|setTimeout|setInterval)\s*\(|Date\.now\s*\(/,
    );
  }
});

test('valid facts yield the exact detached proposal and repeated calls change nothing', () => {
  const input = fixture();
  const before = structuredClone(input);
  Object.freeze(input.quote);
  Object.freeze(input.requestBounds);
  Object.freeze(input.usage);
  Object.freeze(input);
  const expected = {
    ok: true,
    proposal: {
      budgetScope: 'SHARED_AI_TESTING',
      actorId: input.actorId,
      operationId: input.operationId,
      periodKey: '2026-11',
      quoteId: input.quote.id,
      reservationPaise: 100,
      exposureAfterPaise: 100,
      warning80Percent: false,
    },
  };
  const result = propose(input, instant);
  assert.deepEqual(result, expected);
  assert.deepEqual(propose(input, instant), expected);
  assert.deepEqual(input, before);
  const parsed = validate(input);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.quote, input.quote);
  assert.notEqual(parsed.usage, input.usage);
  parsed.quote.worstCasePaise = 999;
  assert.equal(input.quote.worstCasePaise, 100);
  if (result.ok) result.proposal.reservationPaise = 999;
  assert.deepEqual(propose(input, instant), expected);
});

for (const [field, minimum, maximum] of [
  ['instructionBytes', 1, 8192],
  ['inputJsonBytes', 2, 65536],
  ['maxOutputBytes', 2, 65536],
  ['maxOutputTokens', 1, 4096],
  ['budgetMs', 1, 10000],
] as const) {
  for (const value of [minimum, maximum])
    test(`${field} exact allowed bound ${value}`, () => {
      const input = fixture();
      input.requestBounds[field] = value;
      assert.equal(propose(input, instant).ok, true);
    });
  for (const value of [minimum - 1, maximum + 1, 1.5, NaN, Infinity, '1', null])
    test(`${field} refuses ${String(value)} without coercion or clamping`, () => {
      const input = fixture();
      refuses({
        ...input,
        requestBounds: { ...input.requestBounds, [field]: value },
      });
    });
}

for (const [field, values] of [
  ['schemaVersion', [0, 2, '1', true]],
  ['budgetScope', ['PRODUCTION', '', ['SHARED_AI_TESTING']]],
  ['actorId', ['a'.repeat(23), 'A'.repeat(24), 'a'.repeat(24) + '\n', null]],
  [
    'operationId',
    [
      '11111111-1111-1111-8111-111111111111',
      '11111111-1111-4111-7111-111111111111',
      'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      '11111111-1111-4111-8111-111111111111\n',
    ],
  ],
  ['purpose', ['INTERVIEW', '', ['CURRICULUM_OUTLINE']]],
  [
    'periodKey',
    ['1969-12', '10000-01', '2026-00', '2026-13', '2026-1', '2026-11\n'],
  ],
] as const) {
  for (const [index, value] of values.entries())
    test(`${field} malformed identity/literal ${index}`, () => {
      refuses({ ...fixture(), [field]: value });
    });
}

for (const [name, select] of [
  ['root', (input: AiUsageInput) => input],
  ['quote', (input: AiUsageInput) => input.quote],
  ['requestBounds', (input: AiUsageInput) => input.requestBounds],
  ['usage', (input: AiUsageInput) => input.usage],
] as const) {
  test(`${name} rejects every missing key and every operator/unknown/symbol key`, () => {
    const keys = Object.keys(select(fixture()));
    for (const key of keys) {
      const input = fixture();
      Reflect.deleteProperty(select(input), key);
      refuses(input);
    }
    for (const key of [
      '$set',
      'secret',
      '__proto__',
      Symbol('PRIVATE_CANARY'),
    ]) {
      const input = fixture();
      Object.defineProperty(select(input), key, {
        value: 'PRIVATE_CANARY',
        enumerable: true,
      });
      refuses(input);
    }
  });
  test(`${name} rejects accessors and nonenumerable descriptors without reading them`, () => {
    for (const key of Object.keys(select(fixture()))) {
      for (const mode of ['getter', 'setter', 'hidden']) {
        const input = fixture();
        let reads = 0;
        const descriptor =
          mode === 'getter'
            ? {
                enumerable: true,
                get() {
                  reads++;
                  throw new Error('PRIVATE_CANARY');
                },
              }
            : mode === 'setter'
              ? {
                  enumerable: true,
                  set(_value: unknown) {
                    void _value;
                    reads++;
                  },
                }
              : { enumerable: false, value: 0 };
        Object.defineProperty(select(input), key, descriptor);
        refuses(input);
        assert.equal(reads, 0);
      }
    }
  });
  test(`${name} supports null prototype and rejects custom prototypes/proxies`, () => {
    const input = fixture();
    Object.setPrototypeOf(select(input), null);
    assert.equal(propose(input, instant).ok, true);
    Object.setPrototypeOf(select(input), { private: 'PRIVATE_CANARY' });
    refuses(input);
    let traps = 0;
    const proxy = new Proxy(select(fixture()), {
      get() {
        traps++;
        throw new Error('PRIVATE_CANARY');
      },
      ownKeys() {
        traps++;
        throw new Error('PRIVATE_CANARY');
      },
      getPrototypeOf() {
        traps++;
        throw new Error('PRIVATE_CANARY');
      },
    });
    const row = fixture();
    if (name === 'root') refuses(proxy);
    else refuses({ ...row, [name]: proxy });
    assert.equal(traps, 0);
  });
}

for (const value of [
  null,
  undefined,
  [],
  'PRIVATE_CANARY',
  1,
  true,
  () => fixture(),
  new Date(0),
  new Map(),
])
  test(`invalid root kind ${typeof value} ${Object.prototype.toString.call(value)}`, () => {
    refuses(value);
    assert.throws(() => validate(value), safeError);
  });

test('revoked proxies and coercible scalars refuse without invoking caller code', () => {
  const pair = Proxy.revocable(fixture(), {});
  pair.revoke();
  refuses(pair.proxy);
  let reads = 0;
  const coercible = {
    toString() {
      reads++;
      return '100';
    },
    valueOf() {
      reads++;
      return 100;
    },
    toJSON() {
      reads++;
      throw new Error('PRIVATE_CANARY');
    },
  };
  const input = fixture();
  refuses({ ...input, quote: { ...input.quote, worstCasePaise: coercible } });
  assert.equal(reads, 0);
});

test('every scalar rejects hostile proxies and constructor getters before issue formatting', () => {
  const locations = [
    ['schemaVersion'],
    ['budgetScope'],
    ['actorId'],
    ['operationId'],
    ['purpose'],
    ['periodKey'],
    ['quote', 'id'],
    ['quote', 'periodKey'],
    ['quote', 'worstCasePaise'],
    ...Object.keys(fixture().requestBounds).map((key) => [
      'requestBounds',
      key,
    ]),
    ...Object.keys(fixture().usage).map((key) => ['usage', key]),
  ];
  for (const location of locations) {
    let observations = 0;
    function observed(): never {
      observations++;
      throw new Error('PRIVATE_CANARY');
    }
    const hostile = new Proxy(
      {},
      {
        getPrototypeOf: observed,
        get: observed,
        ownKeys: observed,
        getOwnPropertyDescriptor: observed,
      },
    );
    const custom = Object.create({}) as object;
    Object.defineProperty(custom, 'constructor', { get: observed });
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    for (const value of [hostile, custom, revoked.proxy]) {
      const input = fixture();
      if (location.length === 1) Reflect.set(input, location[0]!, value);
      else {
        const parent = Reflect.get(input, location[0]!) as object;
        Reflect.set(parent, location[1]!, value);
      }
      refuses(input);
      assert.throws(() => validate(input), safeError);
      assert.equal(observations, 0);
    }
  }
});

for (const field of [
  'settledPaise',
  'reservedPaise',
  'unresolvedPriorPaise',
  'openOperations',
  'actorWindowUsed',
] as const) {
  for (const value of [
    -1,
    0.1,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    null,
    '0',
  ])
    test(`${field} refuses unknown/fractional/overflow counter ${String(value)}`, () => {
      const input = fixture();
      refuses({ ...input, usage: { ...input.usage, [field]: value } });
    });
  test(`${field} maximum safe value is exact and conservatively refuses admission`, () => {
    const input = fixture();
    input.usage[field] = Number.MAX_SAFE_INTEGER;
    assert.equal(validate(input).usage[field], Number.MAX_SAFE_INTEGER);
    refuses(
      input,
      field === 'openOperations'
        ? 'CONCURRENCY_LIMIT'
        : field === 'actorWindowUsed'
          ? 'RATE_LIMIT'
          : 'USAGE_FROZEN',
    );
  });
}

for (const value of [
  0,
  -1,
  0.5,
  99.999,
  NaN,
  Infinity,
  null,
  '1',
  Number.MAX_SAFE_INTEGER + 1,
])
  test(`quote refuses unknown or noninteger paise ${String(value)} rather than rounding down`, () => {
    const input = fixture();
    refuses({ ...input, quote: { ...input.quote, worstCasePaise: value } });
  });

test('quotes require exact canonical identity/period and booleans do not coerce', () => {
  for (const value of ['', 'PRIVATE_CANARY', null, ['DRAFT']]) {
    const input = fixture();
    refuses({ ...input, quote: { ...input.quote, id: value } });
    refuses({ ...input, quote: { ...input.quote, periodKey: value } });
    refuses({ ...input, usage: { ...input.usage, frozen: value } });
  }
});

for (const [exposure, warning] of [
  [1, false],
  [79999, false],
  [80000, true],
  [99999, true],
  [100000, true],
] as const)
  test(`exact exposure ${exposure} and 80 percent warning ${warning}`, () => {
    const input = fixture();
    input.quote.worstCasePaise = 1;
    input.usage.settledPaise = exposure - 1;
    const result = propose(input, instant);
    assert(result.ok);
    assert.equal(result.proposal.exposureAfterPaise, exposure);
    assert.equal(result.proposal.warning80Percent, warning);
    assert.equal(result.proposal.reservationPaise, 1);
  });

test('one paise above cap refuses; huge valid quote never overflows or becomes cheap', () => {
  const input = fixture();
  input.usage.reservedPaise = 99901;
  refuses(input, 'BUDGET_EXCEEDED');
  input.quote.worstCasePaise = Number.MAX_SAFE_INTEGER;
  refuses(input, 'BUDGET_EXCEEDED');
  input.usage.settledPaise = Number.MAX_SAFE_INTEGER;
  input.usage.reservedPaise = Number.MAX_SAFE_INTEGER;
  input.usage.unresolvedPriorPaise = Number.MAX_SAFE_INTEGER;
  refuses(input, 'USAGE_FROZEN');
});

test('current settled and held liabilities both contribute without release or mutation', () => {
  const input = fixture();
  input.usage.settledPaise = 30000;
  input.usage.reservedPaise = 49900;
  const before = structuredClone(input);
  const result = propose(input, instant);
  assert(result.ok);
  assert.equal(result.proposal.exposureAfterPaise, 80000);
  assert.equal(result.proposal.warning80Percent, true);
  assert.deepEqual(input, before);
});

test('deterministic refusal priority preserves frozen and uncertain exposure', () => {
  const input = fixture();
  input.quote.periodKey = '2026-12';
  input.usage.frozen = true;
  input.usage.openOperations = 1;
  input.usage.actorWindowUsed = 1;
  input.quote.worstCasePaise = 100001;
  refuses({ ...input, actorId: 'PRIVATE_CANARY' });
  refuses(input, 'QUOTE_MISMATCH');
  input.quote.periodKey = input.periodKey;
  refuses(input, 'USAGE_FROZEN');
  input.usage.frozen = false;
  input.usage.unresolvedPriorPaise = 1;
  refuses(input, 'USAGE_FROZEN');
  input.usage.unresolvedPriorPaise = 0;
  refuses(input, 'CONCURRENCY_LIMIT');
  input.usage.openOperations = 0;
  refuses(input, 'RATE_LIMIT');
  input.usage.actorWindowUsed = 0;
  refuses(input, 'BUDGET_EXCEEDED');
});

test('unknown usage and snapshot shapes cannot silently become zero', () => {
  const input = fixture();
  for (const value of [null, undefined, [], {}, 'PRIVATE_CANARY']) {
    refuses({ ...input, usage: value });
    refuses({ ...input, quote: value });
    refuses({ ...input, requestBounds: value });
  }
});

test('explicit time derives Kolkata month and fixed UTC minute at their distinct boundaries', () => {
  const boundary = Date.parse('2026-11-30T18:30:00.000Z');
  assert.deepEqual(timeAt(boundary - 1), {
    periodKey: '2026-11',
    actorWindowKey: Math.floor((boundary - 1) / 60000),
  });
  assert.deepEqual(timeAt(boundary), {
    periodKey: '2026-12',
    actorWindowKey: Math.floor(boundary / 60000),
  });
  assert.equal(timeAt(59999).actorWindowKey, 0);
  assert.equal(timeAt(60000).actorWindowKey, 1);
  assert.equal(timeAt(60001).actorWindowKey, 1);
  assert.equal(timeAt(0).periodKey, '1970-01');
  assert.equal(timeAt(253402280199999).periodKey, '9999-12');
});

test('leap day, year rollover and host timezone do not change explicit period semantics', () => {
  for (const [text, period] of [
    ['2024-02-29T18:29:59.999Z', '2024-02'],
    ['2024-02-29T18:30:00.000Z', '2024-03'],
    ['2026-12-31T18:29:59.999Z', '2026-12'],
    ['2026-12-31T18:30:00.000Z', '2027-01'],
  ])
    assert.equal(timeAt(Date.parse(text!)).periodKey, period);
});

for (const value of [
  undefined,
  null,
  '2026-11-06',
  -1,
  0.1,
  Infinity,
  NaN,
  253402280200000,
  Number.MAX_SAFE_INTEGER,
  new Date(0),
])
  test(`invalid explicit time refuses without implicit wall clock ${String(value)}`, () => {
    assert.throws(() => timeAt(value), safeError);
    assert.deepEqual(propose(fixture(), value), {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'AI request cannot be admitted',
      },
    });
  });

test('month rollover requires matching quote/root and never releases old uncertainty', () => {
  const input = fixture();
  const december = Date.parse('2026-11-30T18:30:00.000Z');
  assert.deepEqual(propose(input, december), {
    ok: false,
    error: { code: 'QUOTE_MISMATCH', message: 'AI request cannot be admitted' },
  });
  input.periodKey = '2026-12';
  input.quote.periodKey = '2026-12';
  input.usage.unresolvedPriorPaise = 1;
  const result = propose(input, december);
  assert(!result.ok);
  assert.equal(result.error.code, 'USAGE_FROZEN');
  assert.equal(input.usage.unresolvedPriorPaise, 1);
});

test('fixed-minute boundary does not reset a supplied used counter or open operation', () => {
  const input = fixture();
  input.usage.actorWindowUsed = 1;
  for (const at of [instant + 59999, instant + 60000, instant + 60001]) {
    const result = propose(input, at);
    assert(!result.ok);
    assert.equal(result.error.code, 'RATE_LIMIT');
  }
  // Only a new supplied current-window snapshot can propose another admission;
  // this policy cannot authenticate that snapshot or persist a rate counter.
  input.usage.actorWindowUsed = 0;
  assert.equal(propose(input, instant + 60000).ok, true);
  input.usage.openOperations = 1;
  for (const at of [instant, instant + 86400000]) {
    const result = propose(input, at);
    assert(!result.ok);
    assert.equal(result.error.code, 'CONCURRENCY_LIMIT');
  }
});

test('evaluation uses no ambient clock and emits no I/O or private error details', () => {
  try {
    mock.method(Date, 'now', () => {
      throw new Error('PRIVATE_CANARY');
    });
    const result = propose(fixture(), instant);
    assert(result.ok);
    assert.doesNotMatch(
      JSON.stringify(result),
      /PRIVATE_CANARY|stack|cause|usage|requestBounds/,
    );
    refuses({ ...fixture(), private: 'PRIVATE_CANARY' });
  } finally {
    mock.restoreAll();
  }
});
