import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, mock } from 'node:test';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import { Types, Schema } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import {
  assertProposalByteLimit,
  proposalDefinitionDigest,
  proposalData,
  validateProposalStructure,
  validateProposalRecord,
  validateProposalRevisionCreation,
  type ProposalRecord,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import { adminLearningPathProposalDto } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.dto.js';

const ids = {
  row: '1'.repeat(24),
  family: '2'.repeat(24),
  technology: '3'.repeat(24),
  source: '4'.repeat(24),
};
// Independently written vector: do not generate expected digests with production helpers.
function independentDigest(row: Omit<ProposalRecord, 'definitionDigest'>) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'F044-proposal-v1',
        row._id,
        row.proposalId,
        row.technologyId,
        row.revision,
        row.source.id,
        row.source.revision,
        row.source.digest,
        row.title,
        row.objectives,
        row.audience,
        row.depth,
        row.runtime === null ? null : [row.runtime.name, row.runtime.version],
        row.technologyVersion,
        row.prerequisites.map((p) => p.description),
      ]),
      'utf8',
    )
    .digest('hex');
}
function fixture(change: Partial<ProposalRecord> = {}): ProposalRecord {
  const row = {
    _id: ids.row,
    proposalId: ids.family,
    technologyId: ids.technology,
    revision: 1,
    schemaVersion: 1 as const,
    source: { id: ids.source, revision: 1, digest: 'a'.repeat(64) },
    title: 'JavaScript foundation',
    objectives: ['Understand values'],
    audience: 'New developers',
    depth: 'BEGINNER' as const,
    runtime: { name: 'Node.js', version: '24' },
    technologyVersion: 'ES2024',
    prerequisites: [{ description: 'Basic programming' }],
    createdAt: new Date('2026-11-04T00:00:00.000Z'),
    ...change,
  };
  return { ...row, definitionDigest: independentDigest(row) };
}
const binding = (row: ProposalRecord) => ({
  technologyId: row.technologyId,
  source: { ...row.source },
});
function invalid(error: unknown) {
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'Invalid Learning Path proposal');
  assert.equal(error.cause, undefined);
  assert.equal(Object.keys(error).length, 0);
  return true;
}
function rejects(row: unknown, expected = binding(fixture())) {
  assert.throws(() => validateProposalRecord(row, expected), invalid);
}

test('known digest vector and first revision match the approved ordered definition', () => {
  const row = fixture();
  const { definitionDigest: expectedDigest, ...body } = row;
  assert.equal(
    row.definitionDigest,
    'c6fc436ec136e41a33ba201ce9849872f935d9da586b5db615c0162569837e13',
  );
  assert.equal(proposalDefinitionDigest(body), expectedDigest);
  assert.deepEqual(validateProposalRevisionCreation(row, binding(row)), row);
});
test('null targets and empty prerequisites are valid explicit values', () => {
  const row = fixture({
    runtime: null,
    technologyVersion: null,
    prerequisites: [],
  });
  assert.deepEqual(validateProposalRecord(row, binding(row)), row);
  const version = fixture({ runtime: { name: 'Browser', version: null } });
  assert.deepEqual(validateProposalRecord(version, binding(version)), version);
});
for (const key of Object.keys(fixture())) {
  test(`missing required record key ${key} refuses without projection/defaults`, () => {
    const row: Record<string, unknown> = { ...fixture() };
    delete row[key];
    rejects(row);
  });
}
for (const [key, maximum] of [
  ['title', 120],
  ['audience', 500],
  ['technologyVersion', 80],
] as const) {
  for (const length of [1, maximum])
    test(`${key} accepts exact length ${length}`, () => {
      const row = fixture({ [key]: 'x'.repeat(length) });
      assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
    });
  for (const value of [
    '',
    'x'.repeat(maximum + 1),
    ' x',
    'x ',
    ' ',
    '\n',
    'x\u0000y',
    'x\u007fy',
    '\ud800',
    '\udfff',
    1,
    {},
    undefined,
  ]) {
    test(`${key} rejects invalid text case ${String(value).length}-${typeof value}`, () =>
      rejects({ ...fixture(), [key]: value }));
  }
}
for (const field of ['name', 'version'] as const) {
  for (const length of [1, 80])
    test(`runtime ${field} exact ${length}`, () => {
      const row = fixture({
        runtime: { name: 'Runtime', version: '1', [field]: 'x'.repeat(length) },
      });
      assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
    });
  test(`runtime ${field} is required and capped`, () => {
    const runtime: Record<string, unknown> = { name: 'Runtime', version: '1' };
    delete runtime[field];
    rejects({ ...fixture(), runtime });
    rejects({
      ...fixture(),
      runtime: { name: 'Runtime', version: '1', [field]: 'x'.repeat(81) },
    });
  });
}
for (const count of [1, 20])
  test(`objectives valid count ${count} with 240-unit entries`, () => {
    const row = fixture({
      objectives: Array.from({ length: count }, (_, i) =>
        String(i).padEnd(240, 'x'),
      ),
    });
    assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
  });
for (const count of [0, 21])
  test(`objectives invalid count ${count}`, () =>
    rejects({
      ...fixture(),
      objectives: Array.from({ length: count }, (_, i) => String(i)),
    }));
for (const objectives of [[''], ['x'.repeat(241)], ['a', 'a']])
  test(`objectives reject empty/long/duplicate ${objectives.length}-${objectives[0]?.length}`, () =>
    rejects({ ...fixture(), objectives }));
for (const count of [0, 20])
  test(`prerequisites accept bounded count ${count}`, () => {
    const row = fixture({
      prerequisites: Array.from({ length: count }, (_, i) => ({
        description: String(i).padEnd(240, 'x'),
      })),
    });
    assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
  });
test('prerequisite structure, exact-text duplicates and unknown binding fields refuse', () => {
  for (const prerequisites of [
    [{ description: '' }],
    [{ description: 'x'.repeat(241) }],
    [{ description: 'x' }, { description: 'x' }],
    [{ description: 'x', id: ids.row }],
    ['x'],
    Array.from({ length: 21 }, (_, i) => ({ description: String(i) })),
  ])
    rejects({ ...fixture(), prerequisites });
});
test('duplicate comparison is exact and preserves Unicode/case/array order', () => {
  const row = fixture({
    objectives: ['A', 'a', '\u00e9', 'e\u0301'],
    prerequisites: [{ description: 'A' }, { description: 'a' }],
  });
  assert.deepEqual(
    validateProposalRecord(row, binding(row)).objectives,
    row.objectives,
  );
});
for (const depth of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const)
  test(`depth ${depth}`, () => {
    const row = fixture({ depth });
    assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
  });
test('unknown depth/schemaVersion and invalid dates refuse', () => {
  for (const field of [
    { depth: 'EXPERT' },
    { schemaVersion: 2 },
    { createdAt: new Date(NaN) },
    { createdAt: '2026-11-04T00:00:00.000Z' },
  ])
    rejects({ ...fixture(), ...field });
});
for (const field of ['_id', 'proposalId', 'technologyId'] as const) {
  for (const bad of [
    'A'.repeat(24),
    'g'.repeat(24),
    'a'.repeat(23),
    'a'.repeat(25),
    ids.row + '\n',
    ' ' + ids.row,
    { $ne: null },
  ])
    test(`${field} noncanonical identity ${typeof bad}-${String(bad).length}`, () =>
      rejects({ ...fixture(), [field]: bad }));
}
for (const bad of [0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '1'])
  test(`invalid revision ${String(bad)}`, () =>
    rejects({ ...fixture(), revision: bad }));
test('maximum safe revision is a valid record but cannot allocate a successor', () => {
  const row = fixture({ revision: Number.MAX_SAFE_INTEGER });
  assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
  assert.deepEqual(validateProposalStructure(row), row);
  assert.throws(
    () => validateProposalRevisionCreation(row, binding(row), row),
    invalid,
  );
});
test('expected binding rejects unknown/missing/operator fields and every mismatch', () => {
  const row = fixture();
  for (const target of [
    undefined,
    {},
    { ...binding(row), role: 'ADMIN' },
    { ...binding(row), technologyId: '9'.repeat(24) },
    { ...binding(row), technologyId: new Types.ObjectId(ids.technology) },
    {
      technologyId: ids.technology,
      source: { ...row.source, actor: 'PRIVATE_CANARY' },
    },
    ...[
      { id: '9'.repeat(24) },
      { revision: 2 },
      { digest: 'b'.repeat(64) },
    ].map((s) => ({
      technologyId: ids.technology,
      source: { ...row.source, ...s },
    })),
  ]) {
    assert.throws(() => validateProposalRecord(row, target), invalid);
  }
});
test('source ids, versions and digests validate independently of matching expectations', () => {
  for (const source of [
    { ...fixture().source, id: 'z'.repeat(24) },
    { ...fixture().source, revision: 0 },
    { ...fixture().source, digest: 'A'.repeat(64) },
    { ...fixture().source, digest: 'a'.repeat(64) + '\n' },
  ]) {
    const row = { ...fixture(), source };
    rejects(row, binding(row));
  }
});
test('successor allows same source and a newer explicitly bound source revision', () => {
  const previous = fixture();
  for (const source of [
    previous.source,
    { ...previous.source, revision: 2, digest: 'b'.repeat(64) },
  ]) {
    const row = fixture({ _id: '5'.repeat(24), revision: 2, source });
    assert.deepEqual(
      validateProposalRevisionCreation(row, binding(row), previous),
      row,
    );
    // Record/DTO inspection deliberately does not require predecessor history.
    assert.equal(adminLearningPathProposalDto(row, binding(row)).revision, 2);
  }
});
test('creation refuses missing, corrupt or inappropriate predecessor', () => {
  const previous = fixture();
  const row = fixture({ _id: '5'.repeat(24), revision: 2 });
  assert.throws(
    () => validateProposalRevisionCreation(row, binding(row)),
    invalid,
  );
  assert.throws(
    () =>
      validateProposalRevisionCreation(previous, binding(previous), previous),
    invalid,
  );
  assert.throws(
    () =>
      validateProposalRevisionCreation(row, binding(row), {
        ...previous,
        title: 'Tampered',
      }),
    invalid,
  );
  for (const change of [
    { _id: previous._id },
    { revision: 3 },
    { proposalId: '9'.repeat(24) },
    { technologyId: '9'.repeat(24) },
    { createdAt: new Date('2026-11-03T23:59:59.999Z') },
    { source: { ...row.source, id: '9'.repeat(24) } },
    { source: { ...row.source, digest: 'b'.repeat(64) } },
  ]) {
    const next = fixture({ ...row, ...change });
    assert.throws(
      () => validateProposalRevisionCreation(next, binding(next), previous),
      invalid,
    );
  }
  const old = fixture({ source: { ...previous.source, revision: 2 } });
  assert.throws(
    () => validateProposalRevisionCreation(row, binding(row), old),
    invalid,
  );
});
test('digest binds each definition field and excludes only validated lifecycle time', () => {
  const row = fixture();
  const changed = [
    { _id: '9'.repeat(24) },
    { proposalId: '9'.repeat(24) },
    { technologyId: '9'.repeat(24) },
    { revision: 2 },
    { source: { ...row.source, id: '9'.repeat(24) } },
    { source: { ...row.source, revision: 2 } },
    { source: { ...row.source, digest: 'b'.repeat(64) } },
    { title: 'Other' },
    { objectives: ['Other'] },
    { audience: 'Others' },
    { depth: 'ADVANCED' as const },
    { runtime: null },
    { runtime: { name: 'Browser', version: null } },
    { runtime: { name: 'Node.js', version: '25' } },
    { technologyVersion: null },
    { prerequisites: [] },
  ];
  for (const change of changed) {
    const next = fixture(change);
    assert.notEqual(next.definitionDigest, row.definitionDigest);
    rejects({ ...next, definitionDigest: row.definitionDigest }, binding(next));
  }
  const later = fixture({ createdAt: new Date('2026-11-05T00:00:00.000Z') });
  assert.equal(later.definitionDigest, row.definitionDigest);
  const ordered = fixture({
    objectives: ['a', 'b'],
    prerequisites: [{ description: 'a' }, { description: 'b' }],
  });
  assert.notEqual(
    fixture({ ...ordered, objectives: ['b', 'a'] }).definitionDigest,
    ordered.definitionDigest,
  );
  assert.notEqual(
    fixture({
      ...ordered,
      prerequisites: [{ description: 'b' }, { description: 'a' }],
    }).definitionDigest,
    ordered.definitionDigest,
  );
});
test('UTF-8 byte bound accepts exact limit and rejects one extra byte/multibyte excess', () => {
  assert.doesNotThrow(() => assertProposalByteLimit('x'.repeat(65_536)));
  assert.throws(() => assertProposalByteLimit('x'.repeat(65_537)), invalid);
  assert.doesNotThrow(() => assertProposalByteLimit('😀'.repeat(16_384)));
  assert.throws(
    () => assertProposalByteLimit('😀'.repeat(16_384) + 'x'),
    invalid,
  );
  assert.throws(() => assertProposalByteLimit('界'.repeat(21_846)), invalid);
  const row = fixture({
    title: '界'.repeat(120),
    audience: '界'.repeat(500),
    objectives: Array.from({ length: 20 }, (_, i) =>
      String(i).padEnd(240, '界'),
    ),
    prerequisites: Array.from({ length: 20 }, (_, i) => ({
      description: String(i).padEnd(240, '界'),
    })),
  });
  assert.ok(
    Buffer.byteLength(JSON.stringify(row), 'utf8') > JSON.stringify(row).length,
  );
  assert.doesNotThrow(() => validateProposalRecord(row, binding(row)));
  rejects({ ...row, audience: '界'.repeat(65_537) });
});
test('privacy validation occurs before schema projection at every nested level', () => {
  const row = fixture();
  for (const changed of [
    { ...row, stack: 'PRIVATE_CANARY' },
    { ...row, $set: {} },
    { ...row, 'source.digest': 'PRIVATE_CANARY' },
    { ...row, source: { ...row.source, details: 'PRIVATE_CANARY' } },
    { ...row, runtime: { ...row.runtime, token: 'PRIVATE_CANARY' } },
    {
      ...row,
      prerequisites: [
        { description: 'x', error: { message: 'PRIVATE_CANARY' } },
      ],
    },
  ]) {
    assert.throws(
      () => adminLearningPathProposalDto(changed, binding(row)),
      invalid,
    );
  }
});
test('DTO is exact, deep copied, private-digest-free and does not change its input', () => {
  const row = fixture();
  const original = structuredClone(row);
  const out = adminLearningPathProposalDto(row, binding(row));
  assert.deepEqual(
    Object.keys(out).sort(),
    [
      'id',
      'proposalId',
      'technologyId',
      'revision',
      'schemaVersion',
      'title',
      'objectives',
      'audience',
      'depth',
      'runtime',
      'technologyVersion',
      'prerequisites',
      'source',
      'createdAt',
    ].sort(),
  );
  assert.deepEqual(Object.keys(out.source).sort(), ['id', 'revision']);
  assert.ok(!JSON.stringify(out).includes(row.source.digest));
  assert.ok(!JSON.stringify(out).includes(row.definitionDigest));
  out.objectives.push('New');
  out.prerequisites[0]!.description = 'Changed';
  if (out.runtime) out.runtime.name = 'Changed';
  assert.deepEqual(row, original);
});
test('no getters, coercion, symbols, proxies, cycles, sparse or augmented arrays execute', () => {
  let touched = 0;
  const row = fixture();
  const getter = { ...row };
  Object.defineProperty(getter, 'title', {
    get() {
      touched++;
      return 'PRIVATE_CANARY';
    },
    enumerable: true,
  });
  const proxy = new Proxy(row, {
    ownKeys() {
      touched++;
      throw Error('PRIVATE_CANARY');
    },
    getPrototypeOf() {
      touched++;
      throw Error('PRIVATE_CANARY');
    },
  });
  const cycle: Record<string, unknown> = { ...row };
  cycle.extra = cycle;
  const symbol = { ...row, [Symbol('PRIVATE_CANARY')]: true };
  const sparse: string[] = [];
  sparse.length = 1;
  const augmented = ['x'];
  Object.defineProperty(augmented, 'private', { value: true });
  const coercion = {
    toString() {
      touched++;
      return 'x';
    },
  };
  const date = new Date();
  Object.defineProperty(date, 'toJSON', {
    value() {
      touched++;
      return 'PRIVATE_CANARY';
    },
  });
  for (const input of [
    getter,
    proxy,
    cycle,
    symbol,
    { ...row, objectives: sparse },
    { ...row, objectives: augmented },
    { ...row, title: coercion },
    { ...row, createdAt: date },
    Object.create(row),
  ])
    rejects(input);
  assert.equal(touched, 0);
  assert.throws(
    () => proposalData(Array.from({ length: 21 }, () => 'x')),
    invalid,
  );
});
test('stored ObjectIds canonicalize only at identifier fields without text coercion', () => {
  const row = fixture();
  const stored = {
    ...row,
    _id: new Types.ObjectId(row._id),
    proposalId: new Types.ObjectId(row.proposalId),
    technologyId: new Types.ObjectId(row.technologyId),
    source: { ...row.source, id: new Types.ObjectId(row.source.id) },
  };
  assert.deepEqual(validateProposalRecord(stored, binding(row)), row);
  rejects({ ...row, title: new Types.ObjectId(row._id) });
});

for (const separator of [0x85, 0x2028, 0x2029])
  test(`single-line fields reject Unicode separator ${separator} with otherwise correct digest`, () => {
    const text = 'a' + String.fromCharCode(separator) + 'b';
    for (const change of [
      { title: text },
      { objectives: [text] },
      { audience: text },
      { runtime: { name: text, version: '1' } },
      { runtime: { name: 'Runtime', version: text } },
      { technologyVersion: text },
      { prerequisites: [{ description: text }] },
    ]) {
      const row = fixture(change);
      rejects(row, binding(row));
    }
  });

test('model import/explicit registration and validation are disconnected and inert', async () => {
  let effects = 0;
  const forbidden = () => {
    effects++;
    throw new Error('Unexpected runtime effect');
  };
  const spies: { mock: { restore(): void } }[] = [
    mock.method(mongoose, 'connect', forbidden),
    mock.method(mongoose, 'createConnection', forbidden),
    mock.method(mongoose.connection, 'openUri', forbidden),
    mock.method(mongoose.connection, 'createCollection', forbidden),
    mock.method(globalThis, 'fetch', forbidden),
    mock.method(globalThis, 'setTimeout', forbidden),
    mock.method(globalThis, 'setInterval', forbidden),
    mock.method(globalThis, 'setImmediate', forbidden),
    mock.method(net, 'createServer', forbidden),
    mock.method(net, 'connect', forbidden),
    mock.method(net, 'createConnection', forbidden),
    mock.method(net.Server.prototype, 'listen', forbidden),
    mock.method(tls, 'connect', forbidden),
  ];
  for (const method of [
    'spawn',
    'spawnSync',
    'exec',
    'execSync',
    'execFile',
    'execFileSync',
    'fork',
  ] as const)
    spies.push(mock.method(childProcess, method, forbidden));
  const collection = mongoose.Collection.prototype as unknown as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  for (const method of [
    'find',
    'findOne',
    'aggregate',
    'insertOne',
    'insertMany',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'bulkWrite',
    'createIndex',
    'listIndexes',
    'drop',
  ]) {
    assert.equal(typeof collection[method], 'function');
    spies.push(mock.method(collection, method, forbidden));
  }
  // Module-loader reads remain allowed; private configuration/credential reads do not.
  for (const method of ['readFileSync', 'openSync'] as const) {
    const original = fs[method];
    spies.push(
      mock.method(fs, method, (...args: unknown[]) => {
        const path = args[0];
        if (
          typeof path === 'string' &&
          /(?:\.env$|\.dpapi$|[\\/]AppData[\\/]Local[\\/]DeepLearner[\\/])/i.test(
            path,
          )
        )
          return forbidden();
        return Reflect.apply(original, fs, args);
      }),
    );
  }
  const environment = process.env;
  process.env = new Proxy(environment, {
    get(target, key, receiver) {
      if (
        typeof key === 'string' &&
        /^(?:APP_ENV$|MONGODB_|AUTH_|CORS_|VITE_|NEXT_PUBLIC_)/.test(key)
      )
        return forbidden();
      return Reflect.get(target, key, receiver);
    },
  });
  try {
    const count = Object.keys(mongoose.models).length;
    const module =
      await import('../src/modules/admin/learning-paths/admin-learning-path-proposal.model.js');
    assert.equal(Object.keys(mongoose.models).length, count);
    const {
      registerAdminLearningPathProposalModel: register,
      adminLearningPathProposalSchema: schema,
    } = module;
    assert.equal(mongoose.connection.readyState, 0);
    assert.equal(schema.options.autoCreate, false);
    assert.equal(schema.options.autoIndex, false);
    assert.equal(schema.options.bufferCommands, false);
    assert.equal(schema.options.versionKey, false);
    assert.equal(schema.options.timestamps, false);
    assert.equal(schema.options.strict, 'throw');
    assert.deepEqual(
      schema.indexes(),
      module.proposalIndexes.map((i) => [i.key, i.options]),
    );
    const Model = register();
    assert.equal(register(), Model);
    const row = fixture();
    const doc = new Model(row, binding(row));
    assert.equal(doc.validateSync(), null);
    await doc.validate();
    const raw = doc.toObject({
      virtuals: false,
      getters: false,
      transform: false,
    });
    assert.ok(raw._id instanceof Types.ObjectId);
    assert.ok(raw.source.id instanceof Types.ObjectId);
    assert.equal(raw.createdAt.toISOString(), row.createdAt.toISOString());
    assert.deepEqual(
      adminLearningPathProposalDto(raw, binding(row)),
      adminLearningPathProposalDto(row, binding(row)),
    );
    for (const nullable of [
      fixture({ runtime: null, technologyVersion: null, prerequisites: [] }),
      fixture({ runtime: { name: 'Browser', version: null } }),
    ]) {
      const item = new Model(nullable, binding(nullable));
      assert.equal(item.validateSync(), null);
      await item.validate();
    }
    for (const key of Object.keys(row)) {
      const missing: Record<string, unknown> = { ...row };
      delete missing[key];
      assert.throws(() => new Model(missing, binding(row)), invalid);
    }
    assert.throws(
      () => new Model({ ...row, hidden: 'PRIVATE_CANARY' }, binding(row)),
      invalid,
    );
    // Raw registry construction has no authorized binding; it cannot validate.
    const Base = mongoose.models[module.proposalModelName];
    assert.ok(Base);
    const unbound = new Base(raw);
    await assert.rejects(unbound.validate(), invalid);
    assert.equal(
      unbound.validateSync()?.message,
      'Invalid Learning Path proposal',
    );
    const corrupt = new Base({ ...raw, definitionDigest: 'f'.repeat(64) });
    assert.equal(
      corrupt.validateSync()?.message,
      'Invalid Learning Path proposal',
    );
    // Mongoose's static validator otherwise bypasses document construction/hooks.
    for (const type of [Model, Base]) {
      const input = { ...raw, definitionDigest: 'f'.repeat(64) };
      await assert.rejects(type.validate(input), invalid);
      await assert.rejects(type.validate(input, ['title']), invalid);
      await assert.rejects(
        type.validate(input, { pathsToSkip: ['definitionDigest'] }),
        invalid,
      );
      const standard = type['~standard'];
      const result = await standard.validate({
        ...raw,
        definitionDigest: 'f'.repeat(64),
      });
      assert.ok(
        'issues' in result && result.issues && result.issues.length > 0,
      );
      assert.ok(!JSON.stringify(result).includes('f'.repeat(64)));
    }
    // validateSync bypasses middleware, so the returned constructor also checks it.
    doc.set('title', 'Tampered');
    assert.equal(doc.validateSync()?.message, 'Invalid Learning Path proposal');
    await assert.rejects(doc.validate(), invalid);
    assert.equal(effects, 0);
    mongoose.deleteModel(module.proposalModelName);
    mongoose.model(
      module.proposalModelName,
      new Schema({ other: String }, { autoCreate: false, autoIndex: false }),
    );
    assert.throws(() => register(), invalid);
    mongoose.deleteModel(module.proposalModelName);
  } finally {
    process.env = environment;
    for (const spy of spies) spy.mock.restore();
  }
});
test('immutable model middleware rejects supported mutation operations without dispatch', async () => {
  const { adminLearningPathProposalSchema: schema } =
    await import('../src/modules/admin/learning-paths/admin-learning-path-proposal.model.js');
  // Execute only hook bodies on inert doubles, never Model write/query methods.
  const hooks = (
    schema as unknown as {
      s: {
        hooks: {
          execPre(
            name: string,
            context: object,
            args: unknown[],
            options?: { filter(hook: { fn: { name: string } }): boolean },
          ): Promise<unknown>;
        };
      };
    }
  ).s.hooks;
  for (const name of [
    'updateOne',
    'updateMany',
    'replaceOne',
    'findOneAndUpdate',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
    'bulkWrite',
    'insertMany',
  ])
    await assert.rejects(hooks.execPre(name, {}, []), invalid);
  await assert.rejects(
    hooks.execPre('save', { isNew: false }, [], {
      filter: (hook) => hook.fn.name === 'refuseExistingRevision',
    }),
    invalid,
  );
  for (const name of [
    '_id',
    'proposalId',
    'technologyId',
    'revision',
    'schemaVersion',
    'title',
    'objectives',
    'audience',
    'depth',
    'runtime',
    'technologyVersion',
    'prerequisites',
    'source',
    'definitionDigest',
    'createdAt',
  ])
    assert.equal(schema.path(name).options.immutable, true);
});
