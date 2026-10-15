import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseVisualization,
  validStepSelection,
  type VisualizationData,
} from '../src/lib/visualizations/contracts';

function fixture(): VisualizationData {
  return {
    type: 'ANIMATED_FLOW',
    title: ' Flow ',
    textAlternative: ' A flow. ',
    nodes: [
      { id: 'a', label: ' Start ' },
      { id: 'b', label: 'End' },
    ],
    edges: [{ id: 'a', source: 'a', target: 'b', label: 'Next' }],
    steps: [
      {
        title: ' First ',
        explanation: ' Run the code. ',
        nodeIds: ['a'],
        edgeIds: ['a'],
      },
    ],
    schemaVersion: 1,
  };
}

test('F027 normalizes a fresh F026 projection without mutating or inserting config', () => {
  const input = fixture();
  const before = structuredClone(input);
  const parsed = parseVisualization(input)!;
  assert.equal(parsed.title, 'Flow');
  assert.equal(parsed.nodes[0]!.label, 'Start');
  assert.equal(parsed.steps[0]!.explanation, 'Run the code.');
  assert.ok(!('animationConfig' in parsed));
  parsed.nodes[0]!.label = 'Changed';
  assert.deepEqual(input, before);
});

test('F027 all text field boundaries trim, reject blanks, wrong types and over-limit text', () => {
  const cases: [number, (v: VisualizationData, text: unknown) => void][] = [
    [120, (v, t) => Object.assign(v, { title: t })],
    [4000, (v, t) => Object.assign(v, { textAlternative: t })],
    [120, (v, t) => Object.assign(v.nodes[0]!, { label: t })],
    [1000, (v, t) => Object.assign(v.nodes[0]!, { description: t })],
    [120, (v, t) => Object.assign(v.edges[0]!, { label: t })],
    [120, (v, t) => Object.assign(v.steps[0]!, { title: t })],
    [2000, (v, t) => Object.assign(v.steps[0]!, { explanation: t })],
  ];
  for (const [max, set] of cases) {
    for (const value of [' x ', 'x'.repeat(max), ' ' + 'x'.repeat(max) + ' ']) {
      const v = fixture();
      set(v, value);
      assert.ok(parseVisualization(v));
    }
    for (const value of [
      '',
      ' \n ',
      'x'.repeat(max + 1),
      1,
      false,
      null,
      {},
      ['x'],
    ]) {
      const v = fixture();
      set(v, value);
      assert.equal(parseVisualization(v), null);
    }
  }
});

test('F027 requires exact type/version and required fields; rejects persistence metadata', () => {
  for (const key of [
    'type',
    'schemaVersion',
    'title',
    'textAlternative',
    'nodes',
    'edges',
    'steps',
  ]) {
    const v = fixture() as unknown as Record<string, unknown>;
    delete v[key];
    assert.equal(parseVisualization(v), null, key);
  }
  for (const patch of [
    { type: 'FLOWCHART' },
    { schemaVersion: '1' },
    { schemaVersion: 2 },
    { _id: 'a'.repeat(24) },
    { status: 'PUBLISHED' },
    { createdBy: 'admin' },
  ])
    assert.equal(parseVisualization({ ...fixture(), ...patch }), null);
});

test('F027 accepts optional undefined but rejects null and unknown nested fields', () => {
  const v = fixture();
  Object.assign(v, { animationConfig: undefined });
  Object.assign(v.nodes[0]!, { description: undefined });
  assert.ok(parseVisualization(v));
  for (const container of [v, v.nodes[0]!, v.edges[0]!, v.steps[0]!]) {
    Object.assign(container, { unexpected: 'x' });
    assert.equal(parseVisualization(v), null);
    delete (container as unknown as Record<string, unknown>).unexpected;
  }
  assert.equal(parseVisualization({ ...v, animationConfig: null }), null);
});

test('F027 explicit false autoplay and exact integer duration bounds; no coercion', () => {
  for (const duration of [100, 10000])
    assert.ok(
      parseVisualization({
        ...fixture(),
        animationConfig: { stepDurationMs: duration, autoplay: false },
      }),
    );
  for (const duration of [
    99,
    10001,
    100.5,
    '100',
    NaN,
    Infinity,
    undefined,
    null,
  ])
    assert.equal(
      parseVisualization({
        ...fixture(),
        animationConfig: { stepDurationMs: duration, autoplay: false },
      }),
      null,
    );
  for (const autoplay of [undefined, null, true, 0, 'false'])
    assert.equal(
      parseVisualization({
        ...fixture(),
        animationConfig: { stepDurationMs: 100, autoplay },
      }),
      null,
    );
  assert.equal(
    parseVisualization({
      ...fixture(),
      animationConfig: { stepDurationMs: 100, autoplay: false, loop: false },
    }),
    null,
  );
});

test('F027 exact IDs, namespaces, duplicate IDs and unknown graph references', () => {
  const v = fixture();
  v.nodes.push({ id: 'n'.repeat(64), label: 'Long ID' });
  assert.ok(parseVisualization(v)); // Node and edge may both be named a.
  for (const id of ['n'.repeat(65), 'A', 'a\n', ' a', 'a ', '1a', 'a_b', '']) {
    const input = fixture();
    input.nodes.push({ id, label: 'Bad' });
    assert.equal(parseVisualization(input), null);
  }
  for (const mutate of [
    (v: VisualizationData) => v.nodes.push({ ...v.nodes[0]! }),
    (v: VisualizationData) => v.edges.push({ ...v.edges[0]! }),
    (v: VisualizationData) => {
      v.edges[0]!.source = 'missing';
    },
    (v: VisualizationData) => {
      v.edges[0]!.target = 'missing';
    },
    (v: VisualizationData) => {
      v.steps[0]!.nodeIds = ['missing'];
    },
    (v: VisualizationData) => {
      v.steps[0]!.edgeIds = ['missing'];
    },
    (v: VisualizationData) => {
      v.steps[0]!.nodeIds = ['a', 'a'];
    },
    (v: VisualizationData) => {
      v.steps[0]!.edgeIds = ['a', 'a'];
    },
  ]) {
    const v = fixture();
    mutate(v);
    assert.equal(parseVisualization(v), null);
  }
});

test('F027 permits cycles, self-loops, parallel edges, unused nodes and zero edges', () => {
  const v = fixture();
  v.edges.push(
    { id: 'back', source: 'b', target: 'a', label: 'Cycle' },
    { id: 'self', source: 'a', target: 'a', label: 'Self' },
    { id: 'parallel', source: 'a', target: 'b', label: 'Parallel' },
  );
  v.nodes.push({ id: 'unused', label: 'Unused' });
  assert.ok(parseVisualization(v));
  v.edges = [];
  v.steps[0]!.edgeIds = [];
  assert.ok(parseVisualization(v));
});

test('F027 exact array and step-reference limits; empty graph rejected', () => {
  const v = fixture();
  v.nodes = Array.from({ length: 50 }, (_, i) => ({
    id: `n${i}`,
    label: 'Node',
  }));
  v.edges = Array.from({ length: 100 }, (_, i) => ({
    id: `e${i}`,
    source: 'n0',
    target: 'n49',
    label: 'Edge',
  }));
  v.steps = Array.from({ length: 100 }, () => ({
    title: 'Step',
    explanation: 'Text',
    nodeIds: ['n0'],
    edgeIds: [],
  }));
  v.steps[0]!.nodeIds = v.nodes.map((n) => n.id);
  v.steps[0]!.edgeIds = v.edges.map((e) => e.id);
  assert.ok(parseVisualization(v));
  for (const key of ['nodes', 'edges', 'steps'] as const) {
    assert.equal(
      parseVisualization({ ...v, [key]: [...v[key], v[key][0]!] }),
      null,
    );
    if (key !== 'edges')
      assert.equal(parseVisualization({ ...v, [key]: [] }), null);
  }
  v.steps[0]!.nodeIds = [];
  assert.equal(parseVisualization(v), null);
});

test('F027 rejects getters without invoking them, sparse arrays, symbols and exotic containers', () => {
  let invoked = 0;
  const v = fixture();
  Object.defineProperty(v.nodes[0]!, 'label', {
    get() {
      invoked++;
      return 'secret';
    },
    enumerable: true,
  });
  assert.equal(parseVisualization(v), null);
  assert.equal(invoked, 0);
  const sparse = fixture();
  delete sparse.nodes[0];
  assert.equal(parseVisualization(sparse), null);
  const accessor = fixture();
  Object.defineProperty(accessor.nodes, '0', {
    get() {
      invoked++;
      return {};
    },
  });
  assert.equal(parseVisualization(accessor), null);
  assert.equal(invoked, 0);
  for (const bad of [
    new Date(),
    new Map(),
    () => fixture(),
    Object.assign(Object.create({ x: 1 }), fixture()),
    { ...fixture(), [Symbol('x')]: 1 },
    {
      ...fixture(),
      toJSON() {
        invoked++;
        return {};
      },
    },
    JSON.parse('{"__proto__": {"x": 1}}'),
  ])
    assert.equal(parseVisualization(bad), null);
  const extra = fixture();
  Object.assign(extra.nodes, { extra: 'bad' });
  assert.equal(parseVisualization(extra), null);
  assert.equal(invoked, 0);
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        throw new Error('unavailable');
      },
    },
  );
  assert.equal(parseVisualization(proxy), null);
});

test('F027 normalized UTF-8 authored payload accepts exactly 256 KiB, rejects one byte over', () => {
  const v = fixture();
  v.title = 'Flow';
  v.textAlternative = 'A';
  v.nodes[0]!.label = 'Start';
  v.steps = Array.from({ length: 60 }, () => ({
    title: 'Step',
    explanation: 'é'.repeat(2000),
    nodeIds: ['a'],
    edgeIds: [],
  }));
  // Add ASCII/escaped teaching text until the canonical projection reaches the limit.
  v.nodes[0]!.description = '"\\'.repeat(200);
  while (Buffer.byteLength(JSON.stringify(v), 'utf8') < 260144)
    v.steps.push({
      title: 'Step',
      explanation: 'x'.repeat(1900),
      nodeIds: ['a'],
      edgeIds: [],
    });
  const difference = 262144 - Buffer.byteLength(JSON.stringify(v), 'utf8');
  assert.ok(difference >= 0 && difference <= 3999);
  v.textAlternative += 'x'.repeat(difference);
  assert.equal(Buffer.byteLength(JSON.stringify(v), 'utf8'), 262144);
  assert.ok(parseVisualization(v));
  v.textAlternative += 'x';
  assert.equal(parseVisualization(v), null);
});

test('F027 selection is external, zero-based, strict and revalidated for new data', () => {
  const v = fixture();
  for (const index of [undefined, null, 0])
    assert.ok(validStepSelection(v, index));
  for (const index of [-1, 1, 0.5, NaN, Infinity, '0', false, {}])
    assert.equal(validStepSelection(v, index), false);
  v.steps.push({ ...v.steps[0]! });
  assert.ok(validStepSelection(v, 1));
  assert.equal(validStepSelection(fixture(), 1), false);
});
