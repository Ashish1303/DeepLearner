import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import {
  curriculumBriefDigest,
  type CurriculumBriefRecord,
} from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';

let validate: typeof import('../src/modules/ai/curriculum-outline.validator.js').validateCurriculumOutline;
const effects: string[] = [];
try {
  const forbidden = () => {
    effects.push('UNEXPECTED_EFFECT');
    throw new Error('SYNTHETIC_PRIVATE_CANARY');
  };
  mock.method(net, 'connect', forbidden);
  mock.method(net, 'createConnection', forbidden);
  mock.method(net.Socket.prototype, 'connect', forbidden);
  mock.method(net.Server.prototype, 'listen', forbidden);
  mock.method(tls, 'connect', forbidden);
  mock.method(http, 'request', forbidden);
  mock.method(https, 'request', forbidden);
  mock.method(dgram, 'createSocket', forbidden);
  mock.method(childProcess, 'spawn', forbidden);
  mock.method(childProcess, 'exec', forbidden);
  mock.method(childProcess, 'execFile', forbidden);
  mock.method(childProcess, 'fork', forbidden);
  mock.method(globalThis, 'fetch', forbidden);
  syncBuiltinESMExports();
  validate = (await import('../src/modules/ai/curriculum-outline.validator.js'))
    .validateCurriculumOutline;
  assert.deepEqual(effects, []);
} finally {
  mock.restoreAll();
  syncBuiltinESMExports();
}

/** Synthetic fixtures, never AI-generated, admitted, stored or approved content. */
function brief(): CurriculumBriefRecord {
  const definition = {
    _id: '1'.repeat(24),
    technologyId: '2'.repeat(24),
    schemaVersion: 1 as const,
    revision: 1 as const,
    title: 'Synthetic JavaScript curriculum',
    objectives: ['Understand synthetic examples'],
    audience: 'Synthetic beginner audience',
    depth: 'BEGINNER' as const,
    runtime: { name: 'Node.js', version: null },
    technologyVersion: null,
    prerequisites: [],
    createdBy: '3'.repeat(24),
    createdAt: new Date('2026-11-07T00:00:00.000Z'),
    operationId: '11111111-1111-4111-8111-111111111111',
  };
  return { ...definition, contentDigest: curriculumBriefDigest(definition) };
}

function outline(modules = 1, topics = 1, concepts = 1) {
  const source = brief();
  return {
    schemaVersion: 1,
    technologyId: source.technologyId,
    source: { id: source._id, revision: 1, digest: source.contentDigest },
    title: 'Synthetic outline',
    modules: Array.from({ length: modules }, (_, m) => ({
      title: `Module ${m}`,
      objectives: ['Understand the synthetic module'],
      topics: Array.from({ length: topics }, (_, t) => ({
        title: `Topic ${t}`,
        concepts: Array.from({ length: concepts }, (_, c) => ({
          title: `Concept ${c}`,
        })),
      })),
    })),
  };
}
type OutlineInput = ReturnType<typeof outline>;
const refusal = {
  ok: false,
  code: 'INVALID_OUTLINE',
  message: 'Curriculum outline is invalid',
};
function reject(row: unknown, source: unknown = brief()) {
  const result = validate(
    typeof row === 'string' ? row : JSON.stringify(row),
    source,
  );
  assert.deepEqual(result, refusal);
  assert(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_CANARY'));
}
function accept(row: OutlineInput) {
  const result = validate(JSON.stringify(row), brief());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('Expected valid synthetic outline');
  assert.deepEqual(result.outline, row);
  return result.outline;
}

test('inert import performs no observed network or child-process operation', () => {
  assert.deepEqual(effects, []);
});
test('minimum outline preserves hierarchy order and deterministic results', () => {
  const row = outline(2, 2, 2);
  row.modules.reverse();
  row.modules[0]!.topics.reverse();
  row.modules[0]!.topics[0]!.concepts.reverse();
  const input = JSON.stringify(row);
  const source = brief();
  const before = structuredClone(source);
  assert.deepEqual(validate(input, source), validate(input, source));
  assert.deepEqual(source, before);
  accept(row);
});
test('result is a fresh recursively frozen projection', () => {
  const row = outline();
  const result = accept(row);
  function frozen(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    assert(Object.isFrozen(value));
    for (const child of Object.values(value)) frozen(child);
  }
  frozen(result);
  row.modules[0]!.title = 'Changed synthetic input';
  assert.equal(result.modules[0]!.title, 'Module 0');
});

for (const [name, change] of Object.entries<(row: OutlineInput) => void>({
  'no modules': (r) => {
    r.modules = [];
  },
  'nine modules': (r) => {
    r.modules = outline(9).modules;
  },
  'no topics': (r) => {
    r.modules[0]!.topics = [];
  },
  'nine sibling topics': (r) => {
    r.modules[0]!.topics = outline(1, 9).modules[0]!.topics;
  },
  'no concepts': (r) => {
    r.modules[0]!.topics[0]!.concepts = [];
  },
  'thirteen sibling concepts': (r) => {
    r.modules[0]!.topics[0]!.concepts = outline(
      1,
      1,
      13,
    ).modules[0]!.topics[0]!.concepts;
  },
  'no objectives': (r) => {
    r.modules[0]!.objectives = [];
  },
  'eleven objectives': (r) => {
    r.modules[0]!.objectives = Array.from(
      { length: 11 },
      (_, i) => `Objective ${i}`,
    );
  },
  'duplicate module': (r) => {
    r.modules.push(structuredClone(r.modules[0]!));
  },
  'duplicate topic': (r) => {
    r.modules[0]!.topics.push(structuredClone(r.modules[0]!.topics[0]!));
  },
  'duplicate concept': (r) => {
    r.modules[0]!.topics[0]!.concepts.push(
      structuredClone(r.modules[0]!.topics[0]!.concepts[0]!),
    );
  },
  'duplicate objective': (r) => {
    r.modules[0]!.objectives.push(r.modules[0]!.objectives[0]!);
  },
})) {
  test(`refuses ${name}`, () => {
    const row = outline();
    change(row);
    reject(row);
  });
}
test('accepts exact aggregate maxima and per-parent maxima', () => {
  accept(outline(8, 4, 4)); // 32 Topics, 128 Concepts.
  accept(outline(1, 8, 12));
  const row = outline();
  row.modules[0]!.objectives = Array.from(
    { length: 10 },
    (_, i) => `Objective ${i}`,
  );
  accept(row);
});
test('refuses 33 total Topics even when each parent is valid', () => {
  const row = outline(4, 8);
  row.modules.push(outline().modules[0]!);
  row.modules[4]!.title = 'Module 4';
  reject(row);
});
test('refuses 129 total Concepts even when each parent is valid', () => {
  const row = outline(8, 4, 4);
  row.modules[0]!.topics[0]!.concepts.push({ title: 'Concept 4' });
  reject(row);
});
test('duplicate checks are exact and scoped to siblings', () => {
  const row = outline(2, 2, 2);
  row.modules[0]!.topics[0]!.concepts[1]!.title = 'concept 0';
  accept(row);
});

for (const text of [
  '',
  ' padded',
  'padded ',
  'a\nb',
  'a\rb',
  'a\tb',
  'a\0b',
  'a\x7fb',
  'a\x85b',
  'a\u2028b',
  'a\u2029b',
  '\ud800',
  '\udc00',
  'x'.repeat(121),
]) {
  test(`rejects invalid title ${JSON.stringify(text)}`, () => {
    const row = outline();
    row.title = text;
    reject(row);
    row.title = 'Synthetic outline';
    row.modules[0]!.topics[0]!.concepts[0]!.title = text;
    reject(row);
  });
}
test('accepts exact title/objective text boundaries and valid Unicode', () => {
  const row = outline();
  row.title = 'x'.repeat(120);
  row.modules[0]!.objectives = ['x'.repeat(240)];
  row.modules[0]!.topics[0]!.concepts[0]!.title = 'संकेत 😀';
  accept(row);
  row.modules[0]!.objectives = ['x'.repeat(241)];
  reject(row);
});

for (const scope of ['root', 'source', 'module', 'topic', 'concept'] as const) {
  test(`rejects unknown/operator/private fields at ${scope}`, () => {
    for (const field of [
      'unexpected',
      '$set',
      '__proto__',
      'approved',
      'createdBy',
    ]) {
      const row = outline();
      const target =
        scope === 'root'
          ? row
          : scope === 'source'
            ? row.source
            : scope === 'module'
              ? row.modules[0]!
              : scope === 'topic'
                ? row.modules[0]!.topics[0]!
                : row.modules[0]!.topics[0]!.concepts[0]!;
      Object.defineProperty(target, field, {
        value: 'SYNTHETIC_PRIVATE_CANARY',
        enumerable: true,
      });
      reject(row);
    }
  });
}
for (const raw of [
  '',
  '{',
  'null',
  '[]',
  '1',
  'true',
  '"SYNTHETIC_PRIVATE_CANARY"',
]) {
  test(`rejects malformed or non-object JSON ${raw}`, () => reject(raw));
}
test('rejects non-string input without invoking conversion/accessors', () => {
  let reads = 0;
  const input = {
    toString() {
      reads++;
      return '{}';
    },
  };
  assert.deepEqual(validate(input, brief()), refusal);
  assert.deepEqual(validate(new String('{}'), brief()), refusal);
  assert.equal(reads, 0);
});
test('refuses unknown/missing fields and wrong primitive types', () => {
  const row = outline();
  for (const field of Object.keys(row)) {
    const copy: Record<string, unknown> = structuredClone(row);
    delete copy[field];
    reject(copy);
    copy[field] = null;
    reject(copy);
  }
  reject({ ...row, schemaVersion: '1' });
  reject({ ...row, title: ['Synthetic outline'] });
  reject({ ...row, modules: { 0: row.modules[0] } });
});
test('binds all source/Technology fields without string coercion', () => {
  const row = outline();
  for (const technologyId of [
    '4'.repeat(24),
    'A'.repeat(24),
    '2'.repeat(24) + '\n',
    ['2'.repeat(24)],
    null,
  ])
    reject({ ...row, technologyId });
  for (const id of ['4'.repeat(24), 'A'.repeat(24), ['1'.repeat(24)], null])
    reject({ ...row, source: { ...row.source, id } });
  for (const revision of [0, 2, '1', null])
    reject({ ...row, source: { ...row.source, revision } });
  for (const digest of [
    '0'.repeat(64),
    'A'.repeat(64),
    'a'.repeat(63),
    ['a'.repeat(64)],
    null,
  ])
    reject({ ...row, source: { ...row.source, digest } });
});
test('rejects invalid brief integrity, revision and unsafe input objects safely', () => {
  const row = outline();
  const source = brief();
  reject(row, { ...source, title: 'Changed without digest' });
  reject(row, { ...source, revision: 2 });
  reject(row, { ...source, contentDigest: '0'.repeat(64) });
  reject(row, null);
  let reads = 0;
  const accessor = { ...source };
  Object.defineProperty(accessor, 'title', {
    get() {
      reads++;
      throw new Error('SYNTHETIC_PRIVATE_CANARY');
    },
    enumerable: true,
  });
  reject(row, accessor);
  reject(
    row,
    new Proxy(source, {
      get() {
        reads++;
        throw new Error('SYNTHETIC_PRIVATE_CANARY');
      },
    }),
  );
  assert.equal(reads, 0);
});
test('64 KiB limit counts raw UTF-8 bytes, including JSON whitespace', () => {
  const row = outline();
  row.title = 'संकेत 😀';
  const raw = JSON.stringify(row);
  const exact = raw + ' '.repeat(65_536 - Buffer.byteLength(raw, 'utf8'));
  assert.equal(Buffer.byteLength(exact, 'utf8'), 65_536);
  assert.equal(validate(exact, brief()).ok, true);
  reject(exact + ' ');
});
test('aggregate multi-byte content cannot evade the byte ceiling', () => {
  const row = outline(8, 4, 4);
  for (const m of row.modules) {
    m.objectives = Array.from(
      { length: 10 },
      (_, i) => '界'.repeat(239) + String(i),
    );
    for (const t of m.topics)
      for (let i = 0; i < t.concepts.length; i++)
        t.concepts[i]!.title = '界'.repeat(119) + String(i);
  }
  const raw = JSON.stringify(row);
  assert(raw.length < 65_536);
  assert(Buffer.byteLength(raw, 'utf8') > 65_536);
  reject(raw);
});
test('valid supplied facts establish structure, not authentic provenance', () => {
  // This self-consistent synthetic brief intentionally has no stored authority.
  const result = validate(JSON.stringify(outline()), brief());
  assert(result.ok);
  assert.deepEqual(Object.keys(result), ['ok', 'outline']);
  assert(
    !('approved' in result) &&
      !('admitted' in result) &&
      !('dispatchAuthorized' in result),
  );
});
