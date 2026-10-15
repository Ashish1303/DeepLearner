import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VisualizationData } from '../src/lib/visualizations/contracts';
import {
  abbreviate,
  layoutFlow,
  nodeLabelLines,
} from '../src/lib/visualizations/layout';

function graph(): VisualizationData {
  return {
    type: 'ANIMATED_FLOW',
    schemaVersion: 1,
    title: 'Flow',
    textAlternative: 'Description',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    edges: [
      { id: 'forward', source: 'a', target: 'b', label: 'Forward' },
      { id: 'back', source: 'b', target: 'a', label: 'Back' },
      { id: 'self', source: 'a', target: 'a', label: 'Self' },
      { id: 'parallel', source: 'a', target: 'b', label: 'Parallel' },
    ],
    steps: [
      { title: 'Step', explanation: 'Text', nodeIds: ['a'], edgeIds: [] },
    ],
  };
}

test('F027 deterministic layout preserves authored order and does not mutate data', () => {
  const v = graph();
  const before = structuredClone(v);
  const layout = layoutFlow(v);
  assert.deepEqual(layout, layoutFlow(structuredClone(v)));
  assert.deepEqual(v, before);
  assert.deepEqual(
    layout.nodes.map((n) => [n.id, n.x, n.y]),
    [
      ['a', 32, 32],
      ['b', 32, 208],
    ],
  );
  v.steps[0]!.nodeIds = ['b'];
  assert.deepEqual(layoutFlow(v), layout);
});

test('F027 cycles, self-loops and parallel edges have distinct lanes and directed endpoints', () => {
  const result = layoutFlow(graph());
  assert.equal(new Set(result.edges.map((e) => e.lane)).size, 4);
  assert.equal(result.edges[0]!.path, 'M 288 96 H 352 V 272 H 288');
  assert.equal(result.edges[1]!.path, 'M 288 272 H 480 V 96 H 288');
  assert.equal(result.edges[2]!.path, 'M 288 72 H 608 V 120 H 288');
  assert.equal(result.edges[3]!.path, 'M 288 96 H 736 V 272 H 288');
});

test('F027 zero edges are valid; empty or missing-reference graphs cannot be laid out', () => {
  const v = graph();
  v.edges = [];
  assert.equal(layoutFlow(v).width, 320);
  assert.equal(layoutFlow(v).height, 368);
  v.nodes = [];
  assert.throws(() => layoutFlow(v), RangeError);
  const bad = graph();
  bad.edges[0]!.target = 'missing';
  assert.throws(() => layoutFlow(bad), RangeError);
});

test('F027 maximum geometry, label badges, stroke and marker padding remain bounded', () => {
  const v = graph();
  v.nodes = Array.from({ length: 50 }, (_, i) => ({
    id: `n${i}`,
    label: 'N'.repeat(120),
  }));
  v.edges = Array.from({ length: 100 }, (_, i) => ({
    id: `e${i}`,
    source: `n${i % 50}`,
    target: `n${(i + 1) % 50}`,
    label: 'E'.repeat(120),
  }));
  const result = layoutFlow(v);
  assert.equal(result.width, 13168);
  assert.equal(result.height, 8816);
  for (const node of result.nodes) {
    assert.ok(node.x - 2 >= 0 && node.x + node.width + 2 < result.width);
    assert.ok(node.y - 2 >= 0 && node.y + node.height + 2 < result.height);
  }
  for (const edge of result.edges) {
    assert.ok(edge.labelX + 114 < result.width);
    assert.ok(edge.labelY - 38 >= 0 && edge.labelY + 38 < result.height);
    assert.ok(!/NaN|Infinity/.test(edge.path));
    assert.ok(edge.startY >= 0 && edge.endY < result.height);
  }
});

test('F027 label abbreviation respects code points and explicit ellipses', () => {
  assert.equal(abbreviate('1234567890', 10), '1234567890');
  assert.equal(abbreviate('12345678901', 10), '1234567890…');
  assert.deepEqual(nodeLabelLines('a'.repeat(24)), [
    'a'.repeat(12),
    'a'.repeat(12),
  ]);
  assert.deepEqual(nodeLabelLines('😀'.repeat(25)), [
    '😀'.repeat(12),
    '😀'.repeat(12) + '…',
  ]);
  assert.deepEqual(nodeLabelLines('A'), ['A', '']);
});
