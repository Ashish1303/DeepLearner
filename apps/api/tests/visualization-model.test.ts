import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { mongoose } from '../src/config/database.js';
import {
  Visualization,
  visualizationSchema,
} from '../src/modules/visualizations/visualization.model.js';

function valid() {
  return {
    conceptId: new Types.ObjectId(),
    technologyId: new Types.ObjectId(),
    topicId: new Types.ObjectId(),
    createdBy: new Types.ObjectId(),
    updatedBy: new Types.ObjectId(),
    type: 'ANIMATED_FLOW' as const,
    title: ' Flow ',
    textAlternative: ' A readable flow. ',
    nodes: [
      { id: 'a', label: ' First ', description: ' Explanation ' },
      { id: 'b', label: 'Second' },
    ],
    edges: [{ id: 'a', source: 'a', target: 'b', label: ' Next ' }],
    steps: [
      {
        title: ' Start ',
        explanation: ' Explain the state ',
        nodeIds: ['b', 'a'],
        edgeIds: ['a'],
      },
    ],
  };
}
async function accepts(input: unknown) {
  const doc = new Visualization(input);
  await doc.validate();
  return doc;
}
async function rejects(input: unknown) {
  await assert.rejects(
    async () => {
      const doc = new Visualization(input);
      await doc.validate();
    },
    (error: unknown) =>
      error instanceof Error &&
      ['ValidationError', 'StrictModeError', 'CastError'].includes(error.name),
  );
}

test('minimal/full payloads retain order, trim text and preserve absent options without nested IDs', async () => {
  const doc = await accepts(valid());
  assert.equal(doc.title, 'Flow');
  assert.equal(doc.nodes[0]!.description, 'Explanation');
  assert.equal(doc.nodes[1]!.description, undefined);
  assert.equal(doc.animationConfig, undefined);
  assert.equal(doc.status, 'DRAFT');
  assert.equal(doc.schemaVersion, 1);
  assert.deepEqual([...doc.steps[0]!.nodeIds], ['b', 'a']);
  for (const list of [doc.nodes, doc.edges, doc.steps])
    for (const entry of list) assert(!Object.hasOwn(entry.toObject(), '_id'));
  await accepts({
    ...valid(),
    nodes: [{ id: 'a', label: 'One' }],
    edges: [],
    steps: [{ title: 'One', explanation: 'One', nodeIds: ['a'], edgeIds: [] }],
  });
  const full = await accepts({
    ...valid(),
    animationConfig: { stepDurationMs: 100, autoplay: false },
  });
  assert.deepEqual(full.toObject().animationConfig, {
    stepDurationMs: 100,
    autoplay: false,
  });
});

test('references accept ObjectIds and exact mixed-case 24-hex strings, rejecting substitutes', async () => {
  for (const field of [
    'conceptId',
    'technologyId',
    'topicId',
    'createdBy',
    'updatedBy',
  ]) {
    const id = new Types.ObjectId().toHexString().toUpperCase();
    const doc = await accepts({ ...valid(), [field]: id });
    assert.equal(String(doc.get(field)), id.toLowerCase());
    for (const value of [
      undefined,
      null,
      '',
      'x'.repeat(24),
      'a'.repeat(23),
      'a'.repeat(25),
      'a'.repeat(24) + '\n',
      ' ' + id,
      1,
      true,
      [],
      {},
      Buffer.alloc(12),
      { toHexString: () => id },
    ])
      await rejects({ ...valid(), [field]: value });
  }
});

test('all text fields enforce minimum/maximum, actual strings and optional-null rejection', async () => {
  const cases: [number, (v: unknown) => unknown][] = [
    [120, (v) => ({ ...valid(), title: v })],
    [4000, (v) => ({ ...valid(), textAlternative: v })],
    [
      120,
      (v) => ({
        ...valid(),
        nodes: [{ ...valid().nodes[0], label: v }, valid().nodes[1]],
      }),
    ],
    [
      1000,
      (v) => ({
        ...valid(),
        nodes: [{ ...valid().nodes[0], description: v }, valid().nodes[1]],
      }),
    ],
    [120, (v) => ({ ...valid(), edges: [{ ...valid().edges[0], label: v }] })],
    [120, (v) => ({ ...valid(), steps: [{ ...valid().steps[0], title: v }] })],
    [
      2000,
      (v) => ({ ...valid(), steps: [{ ...valid().steps[0], explanation: v }] }),
    ],
  ];
  for (const [max, input] of cases) {
    await accepts(input(' x '));
    await accepts(input('x'.repeat(max)));
    for (const value of [
      '',
      ' \n ',
      'x'.repeat(max + 1),
      null,
      1,
      true,
      [],
      {},
      { toString: () => 'x' },
    ])
      await rejects(input(value));
  }
});

test('node/edge IDs require the exact alphabet and 64-character bound without normalization', async () => {
  for (const id of ['a', 'a'.repeat(64)]) {
    await accepts({
      ...valid(),
      nodes: [{ id, label: 'N' }],
      edges: [{ id, source: id, target: id, label: 'Loop' }],
      steps: [{ ...valid().steps[0], nodeIds: [id], edgeIds: [id] }],
    });
  }
  for (const id of [
    '',
    'a'.repeat(65),
    'A',
    '1a',
    'a_b',
    'a\n',
    ' a',
    'é',
    1,
    null,
    {},
  ]) {
    await rejects({
      ...valid(),
      nodes: [{ ...valid().nodes[0], id }, valid().nodes[1]],
    });
    await rejects({ ...valid(), edges: [{ ...valid().edges[0], id }] });
  }
});

test('arrays are bounded, dense and explicit without scalar-to-array coercion', async () => {
  for (const key of ['nodes', 'edges', 'steps']) {
    for (const value of [
      undefined,
      null,
      {},
      'x',
      [null],
      [undefined],
      new Array(1),
    ])
      await rejects({ ...valid(), [key]: value });
  }
  await rejects({ ...valid(), nodes: [] });
  await rejects({ ...valid(), steps: [] });
  const nodes = Array.from({ length: 50 }, (_, i) => ({
    id: 'n' + i,
    label: 'Node',
  }));
  const edges = Array.from({ length: 100 }, (_, i) => ({
    id: 'e' + i,
    source: 'n0',
    target: 'n1',
    label: 'Edge',
  }));
  const step = {
    title: 'Step',
    explanation: 'State',
    nodeIds: nodes.map((n) => n.id),
    edgeIds: edges.map((e) => e.id),
  };
  const input = {
    ...valid(),
    nodes,
    edges,
    steps: Array.from({ length: 100 }, () => step),
  };
  await accepts(input);
  await rejects({
    ...input,
    nodes: [...nodes, { id: 'extra', label: 'Extra' }],
  });
  await rejects({ ...input, edges: [...edges, { ...edges[0], id: 'extra' }] });
  await rejects({ ...input, steps: [...input.steps, step] });
  for (const field of ['nodeIds', 'edgeIds'])
    for (const value of [
      undefined,
      null,
      'a',
      [1],
      [null],
      new Array(1),
      Array.from({ length: field === 'nodeIds' ? 51 : 101 }, (_, i) => 'a' + i),
    ])
      await rejects({
        ...valid(),
        steps: [{ ...valid().steps[0], [field]: value }],
      });
  await rejects({ ...valid(), steps: [{ ...valid().steps[0], nodeIds: [] }] });
});

test('graph integrity rejects duplicates/dangling references but permits cycles, parallel edges and unused nodes', async () => {
  await rejects({ ...valid(), nodes: [valid().nodes[0], valid().nodes[0]] });
  await rejects({ ...valid(), edges: [valid().edges[0], valid().edges[0]] });
  for (const field of ['source', 'target'])
    await rejects({
      ...valid(),
      edges: [{ ...valid().edges[0], [field]: 'missing' }],
    });
  for (const field of ['nodeIds', 'edgeIds']) {
    await rejects({
      ...valid(),
      steps: [{ ...valid().steps[0], [field]: ['missing'] }],
    });
    await rejects({
      ...valid(),
      steps: [{ ...valid().steps[0], [field]: ['a', 'a'] }],
    });
  }
  await accepts({
    ...valid(),
    nodes: [...valid().nodes, { id: 'unused', label: 'Unused' }],
    edges: [
      ...valid().edges,
      { id: 'back', source: 'b', target: 'a', label: 'Back' },
      { id: 'loop', source: 'a', target: 'a', label: 'Loop' },
      { ...valid().edges[0], id: 'parallel' },
    ],
    steps: [{ ...valid().steps[0], nodeIds: ['a'] }],
  });
  const changed = await accepts(valid());
  changed.nodes[0]!.id = 'changed';
  await assert.rejects(changed.validate(), /reference/);
});

test('animation config is absent or complete, never defaults autoplay, and rejects true/coercion', async () => {
  for (const duration of [100, 10000])
    await accepts({
      ...valid(),
      animationConfig: { stepDurationMs: duration, autoplay: false },
    });
  for (const value of [
    null,
    {},
    [],
    true,
    { autoplay: false },
    { stepDurationMs: 100 },
  ])
    await rejects({ ...valid(), animationConfig: value });
  for (const autoplay of [undefined, null, true, 'false', 'true', 0, 1, {}, []])
    await rejects({
      ...valid(),
      animationConfig: { stepDurationMs: 100, autoplay },
    });
  for (const duration of [
    undefined,
    null,
    99,
    10001,
    100.5,
    NaN,
    Infinity,
    '100',
    true,
    {},
    [],
  ])
    await rejects({
      ...valid(),
      animationConfig: { stepDurationMs: duration, autoplay: false },
    });
});

test('status/type/version enforce canonical values and real types without adding transitions', async () => {
  for (const status of [
    'DRAFT',
    'AI_GENERATED',
    'IN_REVIEW',
    'CHANGES_REQUIRED',
    'APPROVED',
    'PUBLISHED',
    'ARCHIVED',
  ])
    await accepts({ ...valid(), status });
  for (const [field, values] of Object.entries({
    status: [null, '', 'UNKNOWN', 1, {}],
    type: [undefined, null, 'FLOWCHART', 'execution-flow', 1, {}],
    schemaVersion: [null, 0, 2, '1', true, {}, NaN],
  }))
    for (const value of values) await rejects({ ...valid(), [field]: value });
});

test('unknown/prototype keys, executable structures and accessor inputs are rejected without evaluating text', async () => {
  for (const key of [
    'unexpected',
    '__proto__',
    'constructor',
    'prototype',
    'assets',
    'animations',
  ]) {
    const extra = JSON.parse('{"' + key + '":true}') as Record<string, unknown>;
    await rejects({ ...valid(), ...extra });
    await rejects({
      ...valid(),
      nodes: [{ ...valid().nodes[0], ...extra }, valid().nodes[1]],
    });
    await rejects({ ...valid(), edges: [{ ...valid().edges[0], ...extra }] });
    await rejects({ ...valid(), steps: [{ ...valid().steps[0], ...extra }] });
    await rejects({
      ...valid(),
      animationConfig: { stepDurationMs: 100, autoplay: false, ...extra },
    });
  }
  let calls = 0;
  await rejects({ ...valid(), title: () => calls++ });
  await rejects({
    ...valid(),
    nodes: [
      {
        id: 'a',
        get label() {
          calls++;
          return 'x';
        },
      },
    ],
  });
  assert.equal(calls, 0);
  const text =
    '<script>alert(1)</script> const f = () => fetch("https://example.invalid");';
  const doc = await accepts({ ...valid(), textAlternative: text });
  assert.equal(doc.textAlternative, text);
});

test('aggregate UTF-8 payload accepts exactly 256 KiB and rejects one byte over including escaped/Unicode text', async () => {
  for (const character of ['x', 'é', '"']) {
    const input = valid();
    const steps = Array.from({ length: 100 }, () => ({
      title: 'x'.repeat(120),
      explanation: character.repeat(500),
      nodeIds: ['a'],
      edgeIds: [] as string[],
    }));
    const candidate = {
      ...input,
      title: 'x',
      textAlternative: 'x',
      nodes: Array.from({ length: 50 }, (_, i) => ({
        id: i ? 'n' + i : 'a',
        label: 'x',
        description: 'x'.repeat(1000),
      })),
      edges: Array.from({ length: 100 }, (_, i) => ({
        id: 'e' + i,
        source: 'a',
        target: 'a',
        label: 'x'.repeat(120),
      })),
      steps,
      schemaVersion: 1,
    };
    const bytes = () =>
      Buffer.byteLength(
        JSON.stringify(
          Object.fromEntries(
            [
              'type',
              'title',
              'textAlternative',
              'nodes',
              'edges',
              'steps',
              'schemaVersion',
            ].map((k) => [k, candidate[k as keyof typeof candidate]]),
          ),
        ),
      );
    // Fill remaining capacity with ASCII so the exact boundary is deterministic.
    for (const step of steps) {
      const add = Math.min(
        2000 - step.explanation.length,
        Math.max(0, 262144 - bytes()),
      );
      step.explanation += 'x'.repeat(add);
    }
    assert.equal(bytes(), 262144);
    const doc = await accepts(candidate);
    doc.textAlternative += 'x';
    await assert.rejects(doc.validate(), /256 KiB/);
  }
});

test('model remains disconnected with canonical nonunique indexes and generated audit options', () => {
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal(Visualization.collection.name, 'visualizations');
  for (const option of ['autoCreate', 'autoIndex', 'bufferCommands'] as const)
    assert.equal(visualizationSchema.options[option], false);
  assert.equal(visualizationSchema.options.timestamps, true);
  assert.equal(visualizationSchema.options.strict, 'throw');
  assert.deepEqual(
    visualizationSchema.indexes().map(([key]) => key),
    [
      { conceptId: 1, status: 1 },
      { conceptId: 1, type: 1 },
    ],
  );
  for (const [, options] of visualizationSchema.indexes()) {
    assert(!options.unique);
    assert.equal(options.expireAfterSeconds, undefined);
  }
  assert(visualizationSchema.path('createdAt'));
  assert(visualizationSchema.path('updatedAt'));
});

test('validated save/create generate timestamps and reject invalid writes before the mocked collection', async (t) => {
  const inserted: Record<string, unknown>[] = [];
  t.mock.method(
    Visualization.collection,
    'insertOne',
    async (doc: Record<string, unknown>) => {
      inserted.push(doc);
      return { acknowledged: true, insertedId: doc._id };
    },
  );
  const doc = await Visualization.create(valid());
  assert.equal(inserted.length, 1);
  assert(doc.createdAt instanceof Date && doc.updatedAt instanceof Date);
  assert.equal(inserted[0]?.__v, 0);
  const extraField = { ...valid(), unexpected: true };
  await assert.rejects(Visualization.create(extraField));
  await assert.rejects(
    new Visualization({
      ...valid(),
      animationConfig: { stepDurationMs: 100 },
    }).save(),
  );
  await assert.rejects(
    new Visualization({
      ...valid(),
      edges: [{ ...valid().edges[0], source: 'missing' }],
    }).save(),
  );
  assert.equal(inserted.length, 1);
  assert.equal(mongoose.connection.readyState, 0);
});
