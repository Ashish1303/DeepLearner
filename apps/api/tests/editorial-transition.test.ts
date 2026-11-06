import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import workerThreads from 'node:worker_threads';
import { syncBuiltinESMExports } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { EditorialTransitionInput } from '../src/modules/admin/content-workflow/editorial-transition.schema.js';

let propose: typeof import('../src/modules/admin/content-workflow/editorial-transition.policy.js').proposeEditorialTransition;
let validate: typeof import('../src/modules/admin/content-workflow/editorial-transition.schema.js').validateEditorialTransition;

const effects: string[] = [];
async function loadPolicyInertly() {
  function forbidden() {
    effects.push('FORBIDDEN_EFFECT');
    throw new Error('INERT_IMPORT_REFUSED');
  }
  try {
    mock.method(net, 'connect', forbidden);
    mock.method(net, 'createConnection', forbidden);
    mock.method(net, 'createServer', forbidden);
    mock.method(net.Socket.prototype, 'connect', forbidden);
    mock.method(net.Server.prototype, 'listen', forbidden);
    mock.method(tls, 'connect', forbidden);
    mock.method(tls, 'createServer', forbidden);
    mock.method(http, 'request', forbidden);
    mock.method(http, 'get', forbidden);
    mock.method(https, 'request', forbidden);
    mock.method(https, 'get', forbidden);
    mock.method(dgram, 'createSocket', forbidden);
    mock.method(childProcess, 'spawn', forbidden);
    mock.method(childProcess, 'spawnSync', forbidden);
    mock.method(childProcess, 'exec', forbidden);
    mock.method(childProcess, 'execSync', forbidden);
    mock.method(childProcess, 'execFile', forbidden);
    mock.method(childProcess, 'execFileSync', forbidden);
    mock.method(childProcess, 'fork', forbidden);
    mock.method(workerThreads, 'Worker', forbidden);
    mock.method(process, 'kill', forbidden);
    mock.method(process, 'exit', forbidden);
    mock.method(process, 'chdir', forbidden);
    syncBuiltinESMExports();
    const policy =
      await import('../src/modules/admin/content-workflow/editorial-transition.policy.js');
    const schema =
      await import('../src/modules/admin/content-workflow/editorial-transition.schema.js');
    propose = policy.proposeEditorialTransition;
    validate = schema.validateEditorialTransition;
    assert.deepEqual(effects, []);
  } finally {
    mock.restoreAll();
    syncBuiltinESMExports();
  }
}
// Setup must not depend on whether a test-name pattern selects the import check.
await loadPolicyInertly();
test('first policy imports perform no network listener database or child-process operation', () => {
  assert.deepEqual(effects, []);
});

// Independent contract matrix: do not compute expectations from exported rules.
const states = [
  'DRAFT',
  'AI_GENERATED',
  'IN_REVIEW',
  'CHANGES_REQUIRED',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
] as const;
const actions = ['SUBMIT_FOR_REVIEW', 'REQUEST_CHANGES', 'APPROVE'] as const;
const expectedMatrix = [
  [null, null, null],
  ['IN_REVIEW', null, null],
  [null, 'CHANGES_REQUIRED', 'APPROVED'],
  [null, null, null],
  [null, null, null],
  [null, null, null],
  [null, null, null],
] as const;
function fixture(): EditorialTransitionInput {
  return {
    current: {
      state: 'IN_REVIEW',
      origin: 'AI_GENERATED',
      revision: { id: 'a'.repeat(24), revision: 1, digest: 'b'.repeat(64) },
    },
    expected: { id: 'a'.repeat(24), revision: 1, digest: 'b'.repeat(64) },
    action: 'APPROVE',
  };
}
function safeError(error: unknown) {
  assert(error instanceof Error);
  assert.equal(error.constructor, Error);
  assert.equal(error.message, 'Invalid editorial transition');
  assert.deepEqual(Object.keys(error), []);
  assert.equal(error.cause, undefined);
  assert.equal(JSON.stringify(error), '{}');
  return true;
}
function refuses(input: unknown) {
  assert.throws(() => propose(input), safeError);
}

for (const [s, state] of states.entries()) {
  for (const [a, action] of actions.entries()) {
    test(`contract matrix ${state} with ${action}`, () => {
      const row = fixture();
      row.current.state = state;
      row.action = action;
      const next = expectedMatrix[s]![a];
      if (next === null) refuses(row);
      else assert.equal(propose(row), next);
    });
  }
}

for (const field of ['id', 'revision', 'digest'] as const) {
  test(`exact revision binding rejects mismatched ${field} for every permitted action`, () => {
    for (const action of actions) {
      const row = fixture();
      row.action = action;
      row.current.state =
        action === 'SUBMIT_FOR_REVIEW' ? 'AI_GENERATED' : 'IN_REVIEW';
      const changed = {
        ...row.expected,
        [field]:
          field === 'revision' ? 2 : 'c'.repeat(field === 'id' ? 24 : 64),
      };
      refuses({ ...row, expected: changed });
      refuses({ ...row, current: { ...row.current, revision: changed } });
    }
  });
}
test('matching positive safe-integer boundaries are accepted without increment or normalization', () => {
  for (const revision of [1, Number.MAX_SAFE_INTEGER]) {
    const row = fixture();
    row.current.revision.revision = revision;
    row.expected.revision = revision;
    assert.equal(propose(row), 'APPROVED');
  }
});
const invalidRevisions: unknown[] = [
  0,
  -1,
  1.5,
  Number.MAX_SAFE_INTEGER + 1,
  NaN,
  Infinity,
  -Infinity,
  '1',
  true,
  null,
  undefined,
  1n,
];
for (const [i, revision] of invalidRevisions.entries()) {
  test(`invalid revision boundary ${i} refuses on either side`, () => {
    const row = fixture();
    refuses({ ...row, expected: { ...row.expected, revision } });
    refuses({
      ...row,
      current: {
        ...row.current,
        revision: { ...row.current.revision, revision },
      },
    });
  });
}
for (const [field, length] of [
  ['id', 24],
  ['digest', 64],
] as const) {
  const values: unknown[] = [
    '',
    'a'.repeat(length - 1),
    'a'.repeat(length + 1),
    'A'.repeat(length),
    'g'.repeat(length),
    ' a'.padEnd(length, 'a'),
    'a'.repeat(length) + '\n',
    1,
    {},
    null,
    undefined,
    new String('a'.repeat(length)),
  ];
  for (const [i, value] of values.entries()) {
    test(`invalid ${field} case ${i} refuses without coercion`, () => {
      const row = fixture();
      refuses({ ...row, expected: { ...row.expected, [field]: value } });
      refuses({
        ...row,
        current: {
          ...row.current,
          revision: { ...row.current.revision, [field]: value },
        },
      });
    });
  }
}
for (const [i, origin] of [
  undefined,
  null,
  '',
  'ADMIN_AUTHORED',
  'AI',
  'ai_generated',
  'AI_GENERATED\n',
  true,
  {},
  ['AI_GENERATED'],
].entries()) {
  test(`invalid or missing AI-origin claim ${i} refuses every action`, () => {
    for (const action of actions) {
      const row = fixture();
      row.action = action;
      row.current.state =
        action === 'SUBMIT_FOR_REVIEW' ? 'AI_GENERATED' : 'IN_REVIEW';
      assert.doesNotThrow(() => propose(row));
      refuses({ ...row, current: { ...row.current, origin } });
    }
  });
}
for (const [field, values] of [
  [
    'action',
    [
      'PUBLISH',
      'ARCHIVE',
      'EDIT',
      'REJECT',
      'APPROVE\n',
      'approve',
      '',
      null,
      undefined,
      {},
      1,
    ],
  ],
  [
    'state',
    [
      'REJECTED',
      'RUNNING',
      'SUCCEEDED',
      'IN_REVIEW\n',
      'in_review',
      '',
      null,
      undefined,
      {},
      1,
    ],
  ],
] as const) {
  for (const [i, value] of values.entries()) {
    test(`unknown or malformed ${field} case ${i} refuses`, () => {
      const row = fixture();
      refuses(
        field === 'action'
          ? { ...row, action: value }
          : { ...row, current: { ...row.current, state: value } },
      );
    });
  }
}

const paths = [[], ['current'], ['expected'], ['current', 'revision']] as const;
function target(
  row: EditorialTransitionInput,
  path: readonly string[],
): Record<string, unknown> {
  let value: unknown = row;
  for (const part of path) value = (value as Record<string, unknown>)[part];
  return value as Record<string, unknown>;
}
for (const [i, path] of paths.entries()) {
  test(`strict object level ${i} rejects every missing key`, () => {
    for (const key of Object.keys(target(fixture(), path))) {
      const row = fixture();
      delete target(row, path)[key];
      refuses(row);
    }
  });
  test(`strict object level ${i} rejects private operator dotted and symbol fields`, () => {
    for (const key of [
      'secret',
      'details',
      'stack',
      '$set',
      '__proto__',
      'current.origin',
      Symbol('private'),
    ]) {
      const row = fixture();
      Object.defineProperty(target(row, path), key, {
        value: { nested: 'SYNTHETIC_PRIVATE_CANARY' },
        enumerable: true,
      });
      refuses(row);
    }
  });
  test(`strict object level ${i} refuses getters without invoking them`, () => {
    for (const key of Object.keys(target(fixture(), path))) {
      const row = fixture();
      let reads = 0;
      Object.defineProperty(target(row, path), key, {
        get() {
          reads++;
          throw new Error('SYNTHETIC_PRIVATE_CANARY');
        },
        enumerable: true,
      });
      refuses(row);
      assert.equal(reads, 0);
    }
  });
  test(`strict object level ${i} rejects nonenumerable data fields`, () => {
    const row = fixture();
    const object = target(row, path);
    const key = Object.keys(object)[0]!;
    Object.defineProperty(object, key, {
      value: object[key],
      enumerable: false,
    });
    refuses(row);
  });
  test(`strict object level ${i} rejects custom prototypes and inherited fields`, () => {
    const row = fixture();
    Object.setPrototypeOf(target(row, path), {
      private: 'SYNTHETIC_PRIVATE_CANARY',
    });
    refuses(row);
  });
}
test('proxies and revoked proxies refuse without invoking traps', () => {
  for (const location of ['root', 'current', 'expected', 'revision']) {
    let traps = 0;
    const row = fixture();
    const proxy = new Proxy(
      {},
      {
        get() {
          traps++;
          throw new Error('PRIVATE');
        },
        getPrototypeOf() {
          traps++;
          throw new Error('PRIVATE');
        },
        ownKeys() {
          traps++;
          throw new Error('PRIVATE');
        },
      },
    );
    const input =
      location === 'root'
        ? proxy
        : location === 'current'
          ? { ...row, current: proxy }
          : location === 'expected'
            ? { ...row, expected: proxy }
            : { ...row, current: { ...row.current, revision: proxy } };
    refuses(input);
    assert.equal(traps, 0);
  }
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  refuses(proxy);
});
test('null-prototype own-data input is valid while inherited required properties refuse', () => {
  const row = fixture();
  for (const path of paths) Object.setPrototypeOf(target(row, path), null);
  assert.equal(propose(row), 'APPROVED');
  const inherited = Object.create(fixture());
  refuses(inherited);
});
test('nonrecord values arrays cycles and boxed primitives refuse safely', () => {
  for (const value of [
    null,
    undefined,
    true,
    1,
    'PRIVATE',
    [],
    new Date(),
    new Map(),
    new Set(),
    () => undefined,
  ])
    refuses(value);
  const row: Record<string, unknown> = { ...fixture() };
  row.current = row;
  refuses(row);
});
test('validation returns a detached copy and never modifies frozen input', () => {
  const row = fixture();
  Object.freeze(row.current.revision);
  Object.freeze(row.expected);
  Object.freeze(row.current);
  Object.freeze(row);
  const before = JSON.stringify(row);
  const parsed = validate(row);
  assert.deepEqual(parsed, row);
  assert.notEqual(parsed, row);
  assert.notEqual(parsed.current, row.current);
  assert.notEqual(parsed.current.revision, row.current.revision);
  parsed.current.revision.id = 'c'.repeat(24);
  assert.equal(JSON.stringify(row), before);
  assert.equal(propose(row), 'APPROVED');
});
test('evaluation is deterministic independent of clock random and environment and does not mutate', () => {
  const row = fixture();
  const before = JSON.stringify(row);
  try {
    mock.method(Date, 'now', () => {
      throw new Error('CLOCK_NOT_ALLOWED');
    });
    mock.method(Math, 'random', () => {
      throw new Error('RANDOM_NOT_ALLOWED');
    });
    for (let i = 0; i < 20; i++) assert.equal(propose(row), 'APPROVED');
  } finally {
    mock.restoreAll();
  }
  assert.equal(JSON.stringify(row), before);
});
test('repeat commands against advanced state refuse but unchanged input is not an idempotency ledger', () => {
  for (const action of actions) {
    const row = fixture();
    row.action = action;
    row.current.state =
      action === 'SUBMIT_FOR_REVIEW' ? 'AI_GENERATED' : 'IN_REVIEW';
    const next = propose(row);
    assert.equal(propose(row), next);
    refuses({ ...row, current: { ...row.current, state: next } });
  }
});
test('changed expected and current revision agree locally without proving a stored record exists', () => {
  const row = fixture();
  row.current.revision = {
    id: 'c'.repeat(24),
    revision: 2,
    digest: 'd'.repeat(64),
  };
  row.expected = { ...row.current.revision };
  assert.equal(propose(row), 'APPROVED');
});
test('production imports contain no database runtime configuration provider or dynamic dependencies', () => {
  const allowed = {
    'editorial-transition.schema.ts': ['node:util', 'zod'],
    'editorial-transition.policy.ts': ['./editorial-transition.schema.js'],
  };
  for (const [name, imports] of Object.entries(allowed)) {
    const source = readFileSync(
      new URL(`../src/modules/admin/content-workflow/${name}`, import.meta.url),
      'utf8',
    );
    const ast = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
    const actual: string[] = [];
    function visit(node: ts.Node) {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        actual.push(node.moduleSpecifier.text);
      assert.notEqual(node.kind, ts.SyntaxKind.ImportKeyword);
      if (ts.isIdentifier(node))
        assert(!['require', 'process', 'fetch'].includes(node.text));
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.deepEqual(actual, imports);
  }
});
