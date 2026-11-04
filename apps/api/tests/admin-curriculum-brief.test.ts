import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, mock } from 'node:test';
import childProcess from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import { Schema, Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import {
  assertBriefByteLimit,
  curriculumBriefDigest,
  curriculumBriefProposalBinding,
  validateCurriculumBriefRecord,
  validateCurriculumBriefStructure,
  type CurriculumBriefRecord,
} from '../src/modules/admin/learning-paths/admin-curriculum-brief.schema.js';
import {
  proposalDefinitionDigest,
  validateProposalRevisionCreation,
} from '../src/modules/admin/learning-paths/admin-learning-path-proposal.schema.js';
import { adminLearningPathProposalDto } from '../src/modules/admin/learning-paths/admin-learning-path-proposal.dto.js';

const technology = '3'.repeat(24);
function independentDigest(row: Omit<CurriculumBriefRecord, 'contentDigest'>) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'F044-admin-brief-v1',
        row._id,
        row.technologyId,
        1,
        1,
        row.title,
        row.objectives,
        row.audience,
        row.depth,
        row.runtime === null ? null : [row.runtime.name, row.runtime.version],
        row.technologyVersion,
        row.prerequisites.map((item) => item.description),
        row.createdBy,
        row.createdAt.toISOString(),
        row.operationId,
      ]),
      'utf8',
    )
    .digest('hex');
}
function fixture(
  change: Partial<CurriculumBriefRecord> = {},
): CurriculumBriefRecord {
  const row = {
    _id: '1'.repeat(24),
    technologyId: technology,
    schemaVersion: 1 as const,
    revision: 1 as const,
    title: 'JavaScript foundation',
    objectives: ['Understand values'],
    audience: 'New developers',
    depth: 'BEGINNER' as const,
    runtime: { name: 'Node.js', version: '24' },
    technologyVersion: 'ES2024',
    prerequisites: [{ description: 'Basic programming' }],
    createdBy: '5'.repeat(24),
    createdAt: new Date('2026-11-04T00:00:00.000Z'),
    operationId: '12345678-1234-4123-8123-123456789abc',
    ...change,
  };
  return { ...row, contentDigest: independentDigest(row) };
}
function invalid(error: unknown) {
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'Invalid curriculum brief');
  assert.equal(error.cause, undefined);
  assert.deepEqual(Object.keys(error), []);
  return true;
}
function rejects(input: unknown, expected: unknown = technology) {
  assert.throws(() => validateCurriculumBriefRecord(input, expected), invalid);
}
function definitionRejects(change: Record<string, unknown>) {
  const { contentDigest: _digest, ...body } = fixture();
  void _digest;
  assert.throws(() => curriculumBriefDigest({ ...body, ...change }), invalid);
}

test('independent fixed source vector and structural binding use the approved bytes', () => {
  const row = fixture();
  const { contentDigest, ...body } = row;
  assert.equal(
    contentDigest,
    'dfe5f095723085fabf4b0a9eae627453560becefb6324203fa6b0f9aa16983ee',
  );
  assert.equal(curriculumBriefDigest(body), contentDigest);
  assert.deepEqual(validateCurriculumBriefStructure(row), row);
  assert.deepEqual(validateCurriculumBriefRecord(row, technology), row);
});
test('required nulls and empty prerequisites remain explicit and valid', () => {
  for (const row of [
    fixture({ runtime: null, technologyVersion: null, prerequisites: [] }),
    fixture({ runtime: { name: 'Browser', version: null } }),
  ])
    assert.deepEqual(validateCurriculumBriefRecord(row, technology), row);
});
const fixedVectors: readonly [
  string,
  Partial<CurriculumBriefRecord>,
  string,
][] = [
  [
    'Unicode and nulls',
    {},
    'd6db58037a0ba31d3efb30c0fe285b881eec499ad62376480b761145b6f84bed',
  ],
  [
    'objective order',
    { objectives: ['A', 'B'] },
    'f3e64f7d90d74fcc9b93890e76b88c38e049c30d7d9fe69d4e49d198c95be475',
  ],
  [
    'prerequisite order',
    { prerequisites: [{ description: 'First' }, { description: 'Second' }] },
    '2dc169cd33193f3aeb96e9cfa29db981d1f5e2e8c7f6c11428e82b8d2e98791b',
  ],
  [
    'actor',
    { createdBy: '6'.repeat(24) },
    '46be55e0ebb006370e4801b44e59372b9a4137ed4dedac011deec99d2f312f22',
  ],
  [
    'time',
    { createdAt: new Date('2026-11-05T00:00:00.000Z') },
    'bac18251332ac68563519bdd4cac847a0670f6c4a49dc5ccdeac16c615110e34',
  ],
  [
    'operation',
    { operationId: '12345678-1234-4123-9123-123456789abc' },
    '48d8d8beb39af01dbdd2c92168786d712665b850e5c2be64136b455cd8075683',
  ],
];
for (const [name, change, fixedDigest] of fixedVectors)
  test(`independently derived fixed digest: ${name}`, () => {
    // Constants derived independently with Python hashlib and compact UTF-8 JSON;
    // these expected values do not call either JavaScript digest implementation.
    const row = fixture({
      title: 'Unicode é 😀',
      objectives: ['B', 'A'],
      runtime: null,
      technologyVersion: null,
      prerequisites: [{ description: 'Second' }, { description: 'First' }],
      ...change,
    });
    const { contentDigest, ...body } = row;
    assert.equal(contentDigest, fixedDigest);
    assert.equal(curriculumBriefDigest(body), fixedDigest);
    assert.equal(
      validateCurriculumBriefRecord(
        { ...row, contentDigest: fixedDigest },
        technology,
      ).contentDigest,
      fixedDigest,
    );
  });
for (const key of Object.keys(fixture()))
  test(`missing ${key} refuses without defaults or projection`, () => {
    const raw: Record<string, unknown> = { ...fixture() };
    delete raw[key];
    rejects(raw);
    if (key !== 'contentDigest')
      assert.throws(() => curriculumBriefDigest(raw), invalid);
  });

for (const [key, maximum] of [
  ['title', 120],
  ['audience', 500],
  ['technologyVersion', 80],
] as const) {
  for (const length of [1, maximum])
    test(`${key} exact length ${length}`, () => {
      const row = fixture({ [key]: 'x'.repeat(length) });
      assert.deepEqual(validateCurriculumBriefRecord(row, technology), row);
    });
  for (const [n, value] of [
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
  ].entries())
    test(`${key} invalid text ${n}`, () => definitionRejects({ [key]: value }));
}
for (const field of ['name', 'version'] as const) {
  for (const length of [1, 80])
    test(`runtime ${field} exact ${length}`, () => {
      const row = fixture({
        runtime: { name: 'Runtime', version: '1', [field]: 'x'.repeat(length) },
      });
      assert.doesNotThrow(() => validateCurriculumBriefRecord(row, technology));
    });
  test(`runtime ${field} missing/overlong/unknown refuses`, () => {
    const runtime: Record<string, unknown> = { name: 'Runtime', version: '1' };
    delete runtime[field];
    definitionRejects({ runtime });
    definitionRejects({
      runtime: { name: 'Runtime', version: '1', [field]: 'x'.repeat(81) },
    });
    definitionRejects({
      runtime: { name: 'Runtime', version: null, hidden: 'CANARY' },
    });
  });
}
for (const count of [1, 20])
  test(`objectives valid count ${count} and 240-unit maximum`, () => {
    const row = fixture({
      objectives: Array.from({ length: count }, (_, i) =>
        String(i).padEnd(240, 'x'),
      ),
    });
    assert.doesNotThrow(() => validateCurriculumBriefRecord(row, technology));
  });
for (const [n, objectives] of [
  [],
  ['a', 'a'],
  [''],
  ['x'.repeat(241)],
  Array.from({ length: 21 }, (_, i) => String(i)),
].entries())
  test(`invalid objectives ${n}`, () => definitionRejects({ objectives }));
for (const count of [0, 20])
  test(`prerequisites valid count ${count} and 240-unit maximum`, () => {
    const row = fixture({
      prerequisites: Array.from({ length: count }, (_, i) => ({
        description: String(i).padEnd(240, 'x'),
      })),
    });
    assert.doesNotThrow(() => validateCurriculumBriefRecord(row, technology));
  });
for (const [n, prerequisites] of [
  [{ description: '' }],
  [{ description: 'x'.repeat(241) }],
  [{ description: 'x' }, { description: 'x' }],
  [{ description: 'x', id: '1'.repeat(24) }],
  ['x'],
  Array.from({ length: 21 }, (_, i) => ({ description: String(i) })),
].entries())
  test(`invalid prerequisites ${n}`, () =>
    definitionRejects({ prerequisites }));
for (const depth of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const)
  test(`depth ${depth}`, () =>
    assert.doesNotThrow(() =>
      validateCurriculumBriefRecord(fixture({ depth }), technology),
    ));
test('no normalization, exact duplicate rules and Unicode order are preserved', () => {
  const row = fixture({
    objectives: ['A', 'a', '\u00e9', 'e\u0301'],
    prerequisites: [{ description: 'A' }, { description: 'a' }],
  });
  assert.deepEqual(validateCurriculumBriefRecord(row, technology), row);
  definitionRejects({ depth: 'EXPERT' });
  definitionRejects({ depth: 'beginner' });
});
for (const separator of [0x85, 0x2028, 0x2029])
  test(`all content fields reject Unicode separator ${separator}`, () => {
    const value = 'a' + String.fromCharCode(separator) + 'b';
    for (const change of [
      { title: value },
      { audience: value },
      { objectives: [value] },
      { runtime: { name: value, version: '1' } },
      { runtime: { name: 'Runtime', version: value } },
      { technologyVersion: value },
      { prerequisites: [{ description: value }] },
    ])
      definitionRejects(change);
  });
test('schema/revision are literal one; no source-revision lifecycle is invented', () => {
  for (const key of ['schemaVersion', 'revision'])
    for (const value of [0, 2, -1, 1.1, NaN, Infinity, '1', null])
      definitionRejects({ [key]: value });
});
test('invalid dates and implicit date coercion refuse', () => {
  for (const createdAt of [new Date(NaN), '2026-11-04T00:00:00.000Z', 0, null])
    definitionRejects({ createdAt });
});
for (const field of ['_id', 'technologyId', 'createdBy'])
  test(`${field} accepts canonical identifiers only`, () => {
    for (const value of [
      '',
      'A'.repeat(24),
      '1'.repeat(23),
      '1'.repeat(25),
      '1'.repeat(24) + '\n',
      1,
      {},
      null,
    ])
      definitionRejects({ [field]: value });
  });
test('operation key is exactly lowercase UUIDv4 with RFC variant', () => {
  for (const operationId of [
    '',
    '12345678-1234-1123-8123-123456789abc',
    '12345678-1234-4123-7123-123456789abc',
    '12345678-1234-4123-C123-123456789ABC',
    '12345678123441238123123456789abc',
    fixture().operationId + '\n',
    null,
    1,
  ])
    definitionRejects({ operationId });
  for (const variant of ['8', '9', 'a', 'b']) {
    const row = fixture({
      operationId: `12345678-1234-4123-${variant}123-123456789abc`,
    });
    assert.doesNotThrow(() => validateCurriculumBriefRecord(row, technology));
  }
});
test('expected Technology is strict independent context, never inferred', () => {
  const row = fixture();
  for (const expected of [
    '4'.repeat(24),
    technology.toUpperCase().replace('3', 'A'),
    new Types.ObjectId(technology),
    {},
    null,
    undefined,
    technology + '\n',
  ]) {
    assert.throws(() => validateCurriculumBriefRecord(row, expected), invalid);
    assert.throws(() => curriculumBriefProposalBinding(row, expected), invalid);
  }
});
test('all bound source content and admission metadata affect the digest', () => {
  const row = fixture();
  for (const change of [
    { _id: '2'.repeat(24) },
    { technologyId: '4'.repeat(24) },
    { createdBy: '6'.repeat(24) },
    { createdAt: new Date('2026-11-05T00:00:00.000Z') },
    { operationId: '12345678-1234-4123-9123-123456789abc' },
    { title: 'Another title' },
    { objectives: ['Another objective'] },
    { audience: 'Another audience' },
    { depth: 'ADVANCED' as const },
    { runtime: null },
    { runtime: { name: 'Browser', version: null } },
    { runtime: { name: 'Node.js', version: '25' } },
    { technologyVersion: null },
    { prerequisites: [] },
  ]) {
    const next = fixture(change);
    assert.notEqual(next.contentDigest, row.contentDigest);
    rejects({ ...next, contentDigest: row.contentDigest }, next.technologyId);
  }
  const ordered = fixture({
    objectives: ['a', 'b'],
    prerequisites: [{ description: 'a' }, { description: 'b' }],
  });
  assert.notEqual(
    fixture({ ...ordered, objectives: ['b', 'a'] }).contentDigest,
    ordered.contentDigest,
  );
  assert.notEqual(
    fixture({
      ...ordered,
      prerequisites: [{ description: 'b' }, { description: 'a' }],
    }).contentDigest,
    ordered.contentDigest,
  );
  for (const contentDigest of [
    '',
    'f'.repeat(64),
    'F'.repeat(64),
    row.contentDigest + '\n',
    null,
    1,
  ])
    rejects({ ...row, contentDigest });
});
test('UTF-8 aggregate helper accepts 65536 bytes and refuses one extra', () => {
  assert.doesNotThrow(() => assertBriefByteLimit('x'.repeat(65536)));
  assert.doesNotThrow(() => assertBriefByteLimit('😀'.repeat(16384)));
  for (const value of [
    'x'.repeat(65537),
    '😀'.repeat(16384) + 'x',
    '界'.repeat(21846),
    {},
    null,
  ])
    assert.throws(() => assertBriefByteLimit(value), invalid);
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
  assert.doesNotThrow(() => validateCurriculumBriefRecord(row, technology));
  // Field bounds are tighter than the aggregate ceiling; no fake full-record boundary claim.
  definitionRejects({ audience: '界'.repeat(65537) });
});
test('unknown/internal/operator fields are refused before any source projection', () => {
  const row = fixture();
  for (const changed of [
    { ...row, actor: 'PRIVATE_CANARY' },
    { ...row, token: 'PRIVATE_CANARY' },
    { ...row, status: 'APPROVED' },
    { ...row, $set: {} },
    { ...row, 'runtime.name': 'PRIVATE_CANARY' },
    { ...row, runtime: { ...row.runtime, stack: 'PRIVATE_CANARY' } },
    {
      ...row,
      prerequisites: [
        { description: 'x', error: { message: 'PRIVATE_CANARY' } },
      ],
    },
  ]) {
    rejects(changed);
    assert.throws(
      () => curriculumBriefProposalBinding(changed, technology),
      invalid,
    );
  }
});
test('inert data validation refuses accessors/proxies/cycles/symbols/coercion', () => {
  let touched = 0;
  const row = fixture();
  const getter = { ...row };
  Object.defineProperty(getter, 'title', {
    enumerable: true,
    get() {
      touched++;
      return 'PRIVATE_CANARY';
    },
  });
  const proxy = new Proxy(row, {
    ownKeys() {
      touched++;
      throw Error('PRIVATE_CANARY');
    },
  });
  const cycle: Record<string, unknown> = { ...row };
  cycle.extra = cycle;
  const sparse: string[] = [];
  sparse.length = 1;
  const augmented = ['x'];
  Object.defineProperty(augmented, 'extra', { value: true });
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
    { ...row, [Symbol('PRIVATE_CANARY')]: true },
    { ...row, objectives: sparse },
    { ...row, objectives: augmented },
    { ...row, createdAt: date },
    {
      ...row,
      title: {
        toString() {
          touched++;
          return 'PRIVATE_CANARY';
        },
      },
    },
    Object.create(row),
  ])
    rejects(input);
  assert.equal(touched, 0);
});
test('stored ObjectIds canonicalize safely, without coercing content', () => {
  const row = fixture();
  const stored = {
    ...row,
    _id: new Types.ObjectId(row._id),
    technologyId: new Types.ObjectId(technology),
    createdBy: new Types.ObjectId(row.createdBy),
  };
  assert.deepEqual(validateCurriculumBriefRecord(stored, technology), row);
  rejects({ ...row, title: new Types.ObjectId(row._id) });
  const original = structuredClone(row);
  const copy = validateCurriculumBriefRecord(row, technology);
  copy.objectives.push('Changed');
  copy.prerequisites[0]!.description = 'Changed';
  if (copy.runtime) copy.runtime.name = 'Changed';
  copy.createdAt.setUTCFullYear(2030);
  assert.deepEqual(row, original);
});
test('C1 binding/DTO reuse exposes no brief metadata and proves no admission', () => {
  const row = fixture();
  const binding = curriculumBriefProposalBinding(row, technology);
  assert.deepEqual(binding, {
    technologyId: technology,
    source: { id: row._id, revision: 1, digest: row.contentDigest },
  });
  binding.source.id = '9'.repeat(24);
  assert.equal(row._id, '1'.repeat(24));
  const expected = curriculumBriefProposalBinding(row, technology);
  const definition = {
    _id: '2'.repeat(24),
    proposalId: row._id,
    technologyId: technology,
    revision: 1,
    schemaVersion: 1,
    source: expected.source,
    title: row.title,
    objectives: row.objectives,
    audience: row.audience,
    depth: row.depth,
    runtime: row.runtime,
    technologyVersion: row.technologyVersion,
    prerequisites: row.prerequisites,
    createdAt: row.createdAt,
  };
  const proposal = {
    ...definition,
    definitionDigest: proposalDefinitionDigest(definition),
  };
  assert.doesNotThrow(() =>
    validateProposalRevisionCreation(proposal, expected),
  );
  const dto = adminLearningPathProposalDto(proposal, expected);
  assert.deepEqual(Object.keys(dto.source).sort(), ['id', 'revision']);
  const serialized = JSON.stringify(dto);
  for (const privateValue of [
    row.contentDigest,
    row.operationId,
    row.createdBy,
    proposal.definitionDigest,
  ])
    assert.ok(!serialized.includes(privateValue));
  // Synthetic data passes structural validation without any account or stored record lookup.
  assert.equal(validateCurriculumBriefStructure(row).revision, 1);
});

test('model imports and explicit registration/validation have no runtime effects', async () => {
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
      await import('../src/modules/admin/learning-paths/admin-curriculum-brief.model.js');
    assert.equal(Object.keys(mongoose.models).length, count);
    const {
      registerAdminCurriculumBriefModel: register,
      adminCurriculumBriefSchema: schema,
    } = module;
    assert.equal(mongoose.connection.readyState, 0);
    for (const key of [
      'autoCreate',
      'autoIndex',
      'bufferCommands',
      'versionKey',
      'timestamps',
    ] as const)
      assert.equal(schema.options[key], false);
    assert.equal(schema.options.strict, 'throw');
    assert.equal(schema.options.collection, 'curriculumBriefRevisions');
    assert.deepEqual(schema.indexes(), [
      [
        { createdBy: 1, operationId: 1 },
        {
          name: 'uq_curriculum_brief_actor_operation',
          unique: true,
          collation: { locale: 'simple' },
        },
      ],
    ]);
    assert.deepEqual(
      schema.indexes(),
      module.curriculumBriefIndexes.map((index) => [index.key, index.options]),
    );
    const Model = register();
    assert.equal(register(), Model);
    const row = fixture();
    const doc = new Model(row, technology);
    await doc.validate();
    assert.equal(doc.validateSync(), null);
    const raw = doc.toObject({
      getters: false,
      virtuals: false,
      transform: false,
    });
    assert.ok(raw._id instanceof Types.ObjectId);
    assert.ok(raw.createdBy instanceof Types.ObjectId);
    assert.deepEqual(validateCurriculumBriefRecord(raw, technology), row);
    for (const nullable of [
      fixture({ runtime: null, technologyVersion: null, prerequisites: [] }),
      fixture({ runtime: { name: 'Browser', version: null } }),
    ]) {
      const item = new Model(nullable, technology);
      await item.validate();
      assert.equal(item.validateSync(), null);
    }
    for (const key of Object.keys(row)) {
      const missing: Record<string, unknown> = { ...row };
      delete missing[key];
      assert.throws(() => new Model(missing, technology), invalid);
    }
    assert.throws(
      () => new Model({ ...row, hidden: 'PRIVATE_CANARY' }, technology),
      invalid,
    );
    assert.throws(() => new Model(row, '4'.repeat(24)), invalid);
    const Base = mongoose.models[module.curriculumBriefModelName];
    assert.ok(Base);
    const unbound = new Base(raw);
    await assert.rejects(unbound.validate(), invalid);
    assert.equal(unbound.validateSync()?.message, 'Invalid curriculum brief');
    const corrupt = new Base({
      ...raw,
      revision: 2,
      contentDigest: 'f'.repeat(64),
    });
    assert.equal(corrupt.validateSync()?.message, 'Invalid curriculum brief');
    for (const type of [Model, Base]) {
      await assert.rejects(type.validate(raw), invalid);
      await assert.rejects(type.validate(raw, ['title']), invalid);
      await assert.rejects(
        type.validate(raw, { pathsToSkip: ['contentDigest'] }),
        invalid,
      );
      const result = await type['~standard'].validate({
        ...raw,
        operationId: 'PRIVATE_CANARY',
      });
      assert.ok(
        'issues' in result && result.issues && result.issues.length > 0,
      );
      assert.ok(!JSON.stringify(result).includes('PRIVATE_CANARY'));
    }
    doc.set('title', 'Tampered');
    await assert.rejects(doc.validate(), invalid);
    assert.equal(doc.validateSync()?.message, 'Invalid curriculum brief');
    const state = Object.getOwnPropertyDescriptor(
      mongoose.connection,
      'readyState',
    );
    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      value: 1,
    });
    try {
      assert.throws(() => register(), invalid);
    } finally {
      if (state)
        Object.defineProperty(mongoose.connection, 'readyState', state);
      else Reflect.deleteProperty(mongoose.connection, 'readyState');
    }
    assert.equal(effects, 0);
    mongoose.deleteModel(module.curriculumBriefModelName);
    mongoose.model(
      module.curriculumBriefModelName,
      new Schema({ other: String }, { autoCreate: false, autoIndex: false }),
    );
    assert.throws(() => register(), invalid);
    mongoose.deleteModel(module.curriculumBriefModelName);
  } finally {
    process.env = environment;
    for (const spy of spies) spy.mock.restore();
  }
});
test('immutable field and operation guards execute only on inert hook doubles', async () => {
  const { adminCurriculumBriefSchema: schema } =
    await import('../src/modules/admin/learning-paths/admin-curriculum-brief.model.js');
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
  for (const isNew of [true, false])
    await assert.rejects(
      hooks.execPre('save', { isNew }, [{ validateBeforeSave: false }], {
        filter: (hook) => hook.fn.name === 'refuseBriefPersistence',
      }),
      invalid,
    );
  for (const key of Object.keys(fixture()))
    assert.equal(schema.path(key).options.immutable, true);
  assert.equal(schema.path('_id').options.auto, false);
  assert.equal(schema.path('objectives').options.default, undefined);
  assert.equal(schema.path('prerequisites').options.default, undefined);
});
