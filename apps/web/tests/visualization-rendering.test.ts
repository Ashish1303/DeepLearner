import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as contracts from '../src/lib/visualizations/contracts';
import * as layout from '../src/lib/visualizations/layout';
import type { VisualizationRendererProps } from '../src/components/visualizations/visualization-renderer';

// Reuse existing static React/TypeScript test pattern; only CSS imports are stubbed.
// Real React useId and actual parser/layout/presentation execute. No mounted claims.
const require = createRequire(import.meta.url);
function component(name: string): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const source = readFileSync(
    new URL(`../src/components/visualizations/${name}.tsx`, import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const load = (path: string): unknown => {
    if (path === '../../lib/visualizations/contracts') return contracts;
    if (path === '../../lib/visualizations/layout') return layout;
    if (path === './animated-flow') return component('animated-flow');
    if (path.endsWith('.module.css'))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      };
    return require(path);
  };
  new Function('require', 'exports', compiled)(load, exports);
  return exports;
}
const Renderer = component('visualization-renderer').VisualizationRenderer as (
  props: VisualizationRendererProps,
) => React.ReactElement;
function fixture(): contracts.VisualizationData {
  return {
    type: 'ANIMATED_FLOW',
    schemaVersion: 1,
    title: 'Flow',
    textAlternative: 'Complete description',
    nodes: [
      {
        id: 'a',
        label: 'A long node label that is complete in HTML',
        description: 'Node explanation',
      },
      { id: 'b', label: 'Second' },
    ],
    edges: [
      {
        id: 'edge',
        source: 'a',
        target: 'b',
        label: 'A long connection label',
      },
    ],
    steps: [
      {
        title: 'First',
        explanation: 'Persistent first explanation',
        nodeIds: ['a'],
        edgeIds: [],
      },
      {
        title: 'Second step',
        explanation: 'Persistent second explanation',
        nodeIds: ['b'],
        edgeIds: ['edge'],
      },
    ],
  };
}
const render = (props: Partial<VisualizationRendererProps> = {}) =>
  renderToStaticMarkup(createElement(Renderer, { data: fixture(), ...props }));

test('F027 overview retains all descriptions and full labels; default is h3', () => {
  const html = render();
  assert.match(html, /<h3[^>]*>Flow<\/h3>/);
  assert.match(html, /<h4[^>]*>Nodes<\/h4>/);
  assert.match(html, /Overview — no step selected/);
  for (const text of [
    'Node explanation',
    'Persistent first explanation',
    'Persistent second explanation',
    fixture().nodes[0]!.label,
    fixture().edges[0]!.label,
  ])
    assert.ok(html.includes(text));
  assert.ok(html.includes('…'));
  assert.doesNotMatch(html, /aria-current|data-selected="true"|<h1/);
});

test('F027 external selection highlights exactly named references and clears in overview', () => {
  const first = render({ selectedStepIndex: 0 });
  assert.match(first, /Step 1 of 2/);
  assert.match(first, /data-node-index="0" data-selected="true"/);
  assert.match(first, /data-node-index="1" data-selected="false"/);
  assert.match(first, /data-edge-index="0" data-selected="false"/);
  assert.equal((first.match(/aria-current="step"/g) ?? []).length, 1);
  const second = render({ selectedStepIndex: 1 });
  assert.match(second, /data-node-index="0" data-selected="false"/);
  assert.match(second, /data-edge-index="0" data-selected="true"/);
  assert.match(second, /Selected/);
  assert.doesNotMatch(
    render({ selectedStepIndex: null }),
    /data-selected="true"|aria-current/,
  );
  const replacement = fixture();
  replacement.steps.pop();
  assert.equal(
    render({ data: replacement, selectedStepIndex: 1 }),
    '<p class="notice">Visualization unavailable.</p>',
  );
});

test('F027 invalid selections and payloads expose no partial content; absent data is distinct', () => {
  for (const data of [null, undefined])
    assert.match(render({ data }), /No visualization available\./);
  for (const data of [
    {},
    { ...fixture(), nodes: [] },
    { ...fixture(), schemaVersion: 2 },
  ])
    assert.equal(
      render({ data }),
      '<p class="notice">Visualization unavailable.</p>',
    );
  for (const selectedStepIndex of [-1, 2, 0.2, Infinity, NaN, '0', false])
    assert.equal(
      render({ selectedStepIndex } as VisualizationRendererProps),
      '<p class="notice">Visualization unavailable.</p>',
    );
  for (const headingLevel of [1, 5, '3', null])
    assert.equal(
      render({ headingLevel } as VisualizationRendererProps),
      '<p class="notice">Visualization unavailable.</p>',
    );
});

test('F027 semantic headings, labelled SVG and native keyboard scroll region', () => {
  for (const headingLevel of [2, 3, 4] as const) {
    const html = render({ headingLevel });
    assert.match(html, new RegExp(`<h${headingLevel}[^>]*>Flow`));
    assert.match(html, new RegExp(`<h${headingLevel + 1}[^>]*>Steps`));
    assert.match(
      html,
      /role="region" tabindex="0" aria-label="Visualization diagram/,
    );
    assert.match(
      html,
      /role="img" aria-labelledby="[^"]+" aria-describedby="[^"]+"/,
    );
    assert.doesNotMatch(html, /<button|<a\b|onkeydown|tabindex="[1-9]/i);
    const ids = new Set(
      [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!),
    );
    for (const match of html.matchAll(
      /aria-(?:labelledby|describedby)="([^"]+)"/g,
    ))
      for (const id of match[1]!.split(' ')) assert.ok(ids.has(id));
  }
});

test('F027 instance IDs are unique; markers and clips refer only to owned fragments', () => {
  const html = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      createElement(Renderer, { data: fixture() }),
      createElement(Renderer, { data: fixture() }),
    ),
  );
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(ids.length, new Set(ids).size);
  for (const match of html.matchAll(/url\(#([^)]*)\)/g))
    assert.ok(ids.includes(match[1]!));
  assert.ok(!ids.includes('a') && !ids.includes('edge'));
});

test('F027 teaching HTML/JavaScript/URLs remain escaped inert text without fetching or execution', () => {
  const v = fixture();
  const attack = '<script>alert(1)</script><img src="https://evil.test/x">';
  v.title = attack;
  v.nodes[0]!.label = attack;
  v.edges[0]!.label = attack;
  v.steps[0]!.explanation =
    'javascript:alert(1) https://evil.test/ const x = "<svg onload=alert(1)>";';
  const html = render({ data: v });
  assert.match(html, /&lt;script&gt;/);
  assert.ok(html.includes('javascript:alert(1)'));
  assert.doesNotMatch(
    html,
    /<(?:script|image|img|foreignObject|iframe|animate|set)\b|<[^>]+\s(?:href|src|onload)=/i,
  );
  for (const name of ['visualization-renderer', 'animated-flow']) {
    const source = readFileSync(
      new URL(`../src/components/visualizations/${name}.tsx`, import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(
      source,
      /fetch\(|setTimeout\(|setInterval\(|dangerouslySetInnerHTML|requestAnimationFrame|useEffect/,
    );
  }
});

test('F027 static CSS contains overflow and focus rules without motion; text contrast meets targets', () => {
  const css = readFileSync(
    new URL(
      '../src/components/visualizations/visualization.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /max-height:\s*480px/);
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*3px/s);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /stroke-dasharray:/);
  assert.doesNotMatch(
    css,
    /(?:animation|transition|scroll-behavior)\s*:|overflow-x:\s*hidden/,
  );
  function luminance(hex: string) {
    const c = hex
      .match(/\w\w/g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
  }
  function contrast(a: string, b: string) {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  for (const background of ['ffffff', 'f0f7f5', 'f8fafc', 'eef2ff'])
    assert.ok(contrast('173b37', background) >= 4.5);
  for (const color of ['087f72', '3525cd', '526e69'])
    assert.ok(contrast(color, 'f8fafc') >= 3);
});
