import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as contracts from '../src/lib/visualizations/contracts';
import * as layout from '../src/lib/visualizations/layout';
import * as playback from '../src/lib/visualizations/playback-controller';
import {
  javascriptClosureCode as code,
  javascriptClosureLesson as lesson,
} from '../src/lib/visualizations/lessons/javascript-closure';
import type { VisualizationRendererProps } from '../src/components/visualizations/visualization-renderer';
import type { VisualizationPlayerProps } from '../src/components/visualizations/visualization-player';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
// Existing static React/TypeScript pattern: execute trusted components, never lesson code.
function component(name: string): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(
    read(`../src/components/visualizations/${name}.tsx`),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const resolve = (path: string): unknown => {
    if (path.endsWith('/contracts')) return contracts;
    if (path.endsWith('/layout')) return layout;
    if (path.endsWith('/playback-controller')) return playback;
    if (path.endsWith('.module.css'))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      };
    if (path.startsWith('./')) return component(path.slice(2));
    return require(path);
  };
  new Function('require', 'exports', compiled)(resolve, exports);
  return exports;
}
const Renderer = component('visualization-renderer')
  .VisualizationRenderer as React.ComponentType<VisualizationRendererProps>;
const Player = component('visualization-player')
  .VisualizationPlayer as React.ComponentType<VisualizationPlayerProps>;
const props = {
  data: lesson,
  accountKey: 'synthetic-account',
  visualizationKey: 'synthetic-closure',
};
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  assert.notEqual(value, undefined, `Missing item ${index}`);
  return value!;
}
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

test('F029 authored projection validates without defaults, metadata or excess payload', () => {
  assert.deepEqual(contracts.parseVisualization(lesson), lesson);
  assert.deepEqual(
    Object.keys(lesson).sort(),
    [
      'type',
      'schemaVersion',
      'title',
      'textAlternative',
      'nodes',
      'edges',
      'steps',
    ].sort(),
  );
  assert.equal(lesson.type, 'ANIMATED_FLOW');
  assert.equal(lesson.schemaVersion, 1);
  assert.deepEqual(
    [lesson.nodes.length, lesson.edges.length, lesson.steps.length],
    [6, 7, 6],
  );
  assert.ok(Buffer.byteLength(JSON.stringify(lesson)) <= 262144);
  assert.equal('animationConfig' in lesson, false);
  const geometry = layout.layoutFlow(lesson);
  assert.equal(geometry.width, 1264);
  assert.equal(geometry.height, 1072);
});

test('F029 content is exactly the owner-reviewed code, graph and ordered narrative', () => {
  const plan = read(
    '../../../docs/features/F029-first-real-visual-lesson.md',
  ).replace(/\r/g, '');
  assert.equal(code, plan.match(/```js\n([\s\S]*?)\n```/)![1]);
  const rows = (start: string, end: string) =>
    plan
      .slice(plan.indexOf(start), plan.indexOf(end))
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| ---'))
      .slice(1)
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
  assert.deepEqual(
    lesson.nodes,
    rows('| Node ID', '| Edge ID').map(([id, label, description]) => ({
      id,
      label,
      description,
    })),
  );
  assert.deepEqual(
    lesson.edges,
    rows('| Edge ID', 'Use the six titles').map(
      ([id, source, target, label]) => ({ id, source, target, label }),
    ),
  );
  const section = plan.slice(
    plan.indexOf('1. **Call makeCounter**'),
    plan.indexOf('\nThe step 3 visual'),
  );
  const narrative = [
    ...section.matchAll(/\d\. \*\*([^\n]+)\*\*\n([\s\S]*?)(?=\n\d\. \*\*|$)/g),
  ].map((match) => ({ title: match[1], explanation: normalize(at(match, 2)) }));
  assert.deepEqual(
    lesson.steps.map(({ title, explanation }) => ({ title, explanation })),
    narrative,
  );
  assert.equal(
    lesson.textAlternative,
    normalize(at(plan.match(/- textAlternative: `([\s\S]*?)`/)!, 1)),
  );
});

test('F029 creation, return and same-binding outputs remain educationally explicit', () => {
  assert.match(
    at(lesson.steps, 2).explanation,
    /function expression creates increment/,
  );
  assert.match(
    at(lesson.steps, 2).explanation,
    /returns that function without calling it/,
  );
  assert.match(
    at(lesson.steps, 2).explanation,
    /active call-stack frame is removed/,
  );
  assert.match(
    at(lesson.steps, 3).explanation,
    /count from 0 to 1, and returns 1/,
  );
  assert.match(
    at(lesson.steps, 4).explanation,
    /count from 1 to 2, and returns 2/,
  );
  assert.match(at(lesson.steps, 4).explanation, /first remains 1/);
  assert.match(at(lesson.steps, 5).explanation, /does not copy count/);
  assert.match(
    at(lesson.steps, 5).explanation,
    /does not preserve an entire active call stack/,
  );
  assert.match(at(lesson.steps, 5).explanation, /without making a third call/);
  assert.match(
    code,
    /const first = counter\(\); {2}\/\/ 1\nconst second = counter\(\); \/\/ 2$/,
  );
});

test('F029 highlights identify creation, same binding and distinct result stages', () => {
  const expectedNodes = [
    [0, 1],
    [1, 2],
    [0, 3, 1],
    [3, 1, 2, 4],
    [3, 1, 2, 5],
    [3, 1, 2],
  ];
  const expectedEdges = [[0], [1], [2, 3], [3, 4, 5], [3, 4, 6], [3, 1]];
  lesson.steps.forEach((step, i) => {
    assert.deepEqual(
      step.nodeIds,
      at(expectedNodes, i).map((index) => at(lesson.nodes, index).id),
    );
    assert.deepEqual(
      step.edgeIds,
      at(expectedEdges, i).map((index) => at(lesson.edges, index).id),
    );
  });
  assert.equal(new Set(lesson.nodes.map((node) => node.id)).size, 6);
  assert.equal(new Set(lesson.edges.map((edge) => edge.id)).size, 7);
});

test('F029 malformed lesson clones fail closed without mutating approved data', () => {
  const before = JSON.stringify(lesson);
  const invalid = [
    { ...lesson, sourceUrl: 'https://example.test' },
    { ...lesson, schemaVersion: '1' },
    { ...lesson, steps: [] },
    { ...lesson, animationConfig: { stepDurationMs: 2000, autoplay: true } },
    { ...lesson, nodes: [...lesson.nodes, lesson.nodes[0]] },
    { ...lesson, edges: [{ ...lesson.edges[0], target: 'missing' }] },
    { ...lesson, steps: [{ ...lesson.steps[0], nodeIds: ['missing'] }] },
    { ...lesson, steps: [{ ...lesson.steps[0], edgeIds: ['missing'] }] },
    {
      ...lesson,
      steps: [
        { ...lesson.steps[0], nodeIds: ['make-counter', 'make-counter'] },
      ],
    },
    { ...lesson, steps: [{ ...lesson.steps[0], explanation: ' ' }] },
  ];
  invalid.forEach((data) =>
    assert.equal(contracts.parseVisualization(data), null),
  );
  assert.equal(JSON.stringify(lesson), before);
});

test('F029 real renderer exposes full text and exact highlights for every stage', () => {
  for (const selectedStepIndex of [null, 0, 1, 2, 3, 4, 5]) {
    const html = renderToStaticMarkup(
      React.createElement(Renderer, {
        data: lesson,
        selectedStepIndex,
        headingLevel: 2,
      }),
    );
    assert.match(html, /<svg/);
    assert.match(html, /role="region" tabindex="0"/);
    for (const node of lesson.nodes) assert.ok(html.includes(node.label));
    for (const step of lesson.steps) assert.ok(html.includes(step.explanation));
    const nodes = [
      ...html.matchAll(/data-node-index="(\d+)" data-selected="true"/g),
    ].map((match) => at(lesson.nodes, Number(match[1])).id);
    const edges = [
      ...html.matchAll(/data-edge-index="(\d+)" data-selected="true"/g),
    ].map((match) => at(lesson.edges, Number(match[1])).id);
    assert.deepEqual(
      nodes.sort(),
      selectedStepIndex === null
        ? []
        : [...at(lesson.steps, selectedStepIndex).nodeIds].sort(),
    );
    assert.deepEqual(
      edges.sort(),
      selectedStepIndex === null
        ? []
        : [...at(lesson.steps, selectedStepIndex).edgeIds].sort(),
    );
  }
});

test('F029 player starts in overview with accessible controls and inert text', () => {
  const html = renderToStaticMarkup(React.createElement(Player, props));
  assert.match(html, /Overview/);
  assert.match(html, /aria-disabled="false">Next/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(
    html,
    /<script|<iframe|<img|synthetic-account|synthetic-closure/,
  );
  const unsafe = { ...lesson, title: '<script>alert(1)</script>' };
  const escaped = renderToStaticMarkup(
    React.createElement(Renderer, { data: unsafe }),
  );
  assert.match(escaped, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(escaped, /<script/);
});

test('F029 six-stage playback uses fallback intervals, completes, replays and cancels stale work', () => {
  const pending = new Map<number, () => void>();
  let id = 0;
  const controller = playback.createPlaybackController(props, {
    schedule(callback, delay) {
      assert.equal(delay, 2000);
      pending.set(++id, callback);
      return id;
    },
    cancel(handle) {
      pending.delete(handle as number);
    },
  });
  controller.connect();
  controller.setEnvironment(true, false);
  assert.equal(pending.size, 0);
  controller.dispatch('primary');
  for (let index = 0; index < 6; index++) {
    assert.equal(controller.getSnapshot().selectedStepIndex, index);
    assert.equal(controller.getSnapshot().mode, 'playing');
    assert.equal(pending.size, 1);
    const [key, callback] = at([...pending], 0);
    pending.delete(key);
    callback();
  }
  assert.equal(controller.getSnapshot().mode, 'completed');
  assert.equal(pending.size, 0);
  controller.dispatch('primary');
  assert.equal(controller.getSnapshot().selectedStepIndex, 0);
  const stale = at([...pending.values()], 0);
  controller.dispatch('reset');
  stale();
  assert.equal(controller.getSnapshot().selectedStepIndex, null);
  assert.equal(pending.size, 0);
  controller.setEnvironment(true, true);
  controller.dispatch('primary');
  assert.equal(pending.size, 0);
  controller.dispatch('next');
  assert.equal(controller.getSnapshot().selectedStepIndex, 0);
  controller.disconnect();
});

test('F029 fixture preserves gate, synthetic defaults and inert code boundaries', () => {
  const fixture = read(
    '../src/app/(test)/test/visualizations/fixture-client.tsx',
  );
  const page = read('../src/app/(test)/test/visualizations/page.tsx');
  const config = read('../../../playwright.f024.config.ts');
  const source = read(
    '../src/lib/visualizations/lessons/javascript-closure.ts',
  );
  assert.match(page, /dynamic = 'force-dynamic'/);
  assert.match(
    page,
    /process\.env\.DEEPLEARNER_BROWSER_FIXTURE !== '1'\) notFound\(\)/,
  );
  assert.match(fixture, /useState<unknown>\(graph\)/);
  assert.match(fixture, /data === javascriptClosureLesson/);
  assert.match(fixture, /<code>\{javascriptClosureCode\}<\/code>/);
  for (const label of [
    'Change account',
    'Change visualization',
    'Logout identity',
    'Replace snapshot',
    'Single step',
    'Empty steps',
    'Invalid data',
    'Missing data',
    'Load closure lesson',
  ])
    assert.ok(fixture.includes(label));
  assert.doesNotMatch(
    fixture + source,
    /eval\(|new Function|fetch\(|dangerouslySetInnerHTML|NEXT_PUBLIC.*FIXTURE/,
  );
  assert.match(config, /visualization-lesson\.spec\.ts/);
  assert.match(config, /--hostname 127\.0\.0\.1/);
  assert.match(config, /process\.env\.DEEPLEARNER_BROWSER_FIXTURE === '1'/);
});
