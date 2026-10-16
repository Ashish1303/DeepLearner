import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as playback from '../src/lib/visualizations/playback-controller';
import * as contracts from '../src/lib/visualizations/contracts';
import * as layout from '../src/lib/visualizations/layout';
import type { VisualizationPlayerProps } from '../src/components/visualizations/visualization-player';

const require = createRequire(import.meta.url);
const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');
function load(
  path: string,
  overrides: Record<string, unknown> = {},
  host: Record<string, unknown> = {},
): Record<string, unknown> {
  const exports: Record<string, unknown> = {};
  const compiled = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const resolve = (name: string): unknown => {
    if (name in overrides) return overrides[name];
    if (name.endsWith('/playback-controller')) return playback;
    if (name.endsWith('/contracts')) return contracts;
    if (name.endsWith('/layout')) return layout;
    if (name.endsWith('.module.css'))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_, key) => String(key) }),
      };
    if (name.startsWith('./'))
      return load(`../src/components/visualizations/${name.slice(2)}.tsx`);
    return require(name);
  };
  new Function('require', 'exports', 'document', 'window', compiled)(
    resolve,
    exports,
    host.document,
    host.window,
  );
  return exports;
}
const path = '../src/components/visualizations/';
const Controls = load(path + 'visualization-controls.tsx')
  .VisualizationControls as React.ComponentType<{
  state: playback.PlaybackState;
  onAction: (action: playback.PlaybackAction) => void;
}>;
const Player = load(path + 'visualization-player.tsx')
  .VisualizationPlayer as React.ComponentType<VisualizationPlayerProps>;
const graph = {
  type: 'ANIMATED_FLOW',
  schemaVersion: 1,
  title: '<script>inert</script>',
  textAlternative: 'Full explanation',
  nodes: [{ id: 'a', label: 'A' }],
  edges: [],
  steps: [
    {
      title: 'First',
      explanation: 'Persistent first text',
      nodeIds: ['a'],
      edgeIds: [],
    },
    {
      title: 'Last',
      explanation: 'Persistent last text',
      nodeIds: ['a'],
      edgeIds: [],
    },
  ],
};
const props = {
  data: graph,
  accountKey: 'opaque-account',
  visualizationKey: 'opaque-graph',
};

test('F028 semantic controls preserve button order, disabled focusability and polite status', () => {
  const c = playback.createPlaybackController(props);
  const html = renderToStaticMarkup(
    React.createElement(Controls, {
      state: c.getSnapshot(),
      onAction: () => {},
    }),
  );
  assert.match(html, /role="group" aria-label="Visualization controls"/);
  assert.equal((html.match(/type="button"/g) ?? []).length, 4);
  assert.match(html, /aria-disabled="true">Previous/);
  assert.match(html, /aria-disabled="false">Next/);
  assert.doesNotMatch(html, / disabled=|autofocus|tabindex="-1"/);
  assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.ok(html.indexOf('Previous') < html.indexOf('Play'));
});

test('F028 SSR player starts in overview with safe real F027 renderer and complete text', () => {
  const html = renderToStaticMarkup(React.createElement(Player, props));
  assert.match(html, /Overview/);
  assert.match(html, /<svg/);
  assert.match(html, /Persistent first text/);
  assert.match(html, /Persistent last text/);
  assert.match(html, /&lt;script&gt;inert&lt;\/script&gt;/);
  assert.doesNotMatch(
    html,
    /<script|<iframe|onclick=|opaque-account|opaque-graph|<img/,
  );
  assert.match(html, /role="region" tabindex="0"/);
});

test('F028 invalid, missing and empty payloads expose truthful disabled presentation', () => {
  for (const data of [
    { ...graph, steps: [] },
    { ...graph, extra: true },
    null,
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(Player, { ...props, data }),
    );
    assert.match(html, /Playback unavailable/);
    assert.equal((html.match(/aria-disabled="true"/g) ?? []).length, 4);
    assert.doesNotMatch(html, /<svg/);
    assert.match(
      html,
      data === null
        ? /No visualization available/
        : /Visualization unavailable/,
    );
  }
});

test('F028 disabled handlers reject invocation and primary button identity remains stable', () => {
  const calls: playback.PlaybackAction[] = [];
  const source = load(path + 'visualization-controls.tsx', {
    react: { ...React, useId: () => 'isolated' },
  });
  const Control = source.VisualizationControls as (args: {
    state: playback.PlaybackState;
    onAction: (action: playback.PlaybackAction) => void;
  }) => React.ReactElement;
  const c = playback.createPlaybackController(props);
  const buttons = (state: playback.PlaybackState) => {
    const tree = Control({
      state,
      onAction: (action) => calls.push(action),
    }) as React.ReactElement<{ children: React.ReactElement[] }>;
    return (
      tree.props.children[0] as React.ReactElement<{
        children: React.ReactElement<{ onClick: () => void }>[];
      }>
    ).props.children;
  };
  const initial = buttons(c.getSnapshot());
  initial[0]!.props.onClick();
  initial[2]!.props.onClick();
  assert.deepEqual(calls, ['next']);
  for (const mode of ['playing', 'paused', 'completed'] as const) {
    assert.equal(
      buttons({ ...c.getSnapshot(), mode, selectedStepIndex: 1 })[1]!.key,
      initial[1]!.key,
    );
  }
});

test('F028 player identity/data replacement resets before rendering; old callbacks cannot populate replacement', () => {
  let memo: unknown,
    dependencies: unknown[] = [],
    effect: (() => void | (() => void)) | undefined;
  let cleanup: (() => void) | undefined;
  const ref = { current: null };
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const motion = Object.assign(new EventTarget(), { matches: false });
  const timers: (() => void)[] = [];
  const stores: playback.PlaybackController[] = [];
  let pendingEffect = false;
  const shim = {
    ...React,
    useMemo(factory: () => unknown, deps: unknown[]) {
      if (deps.some((value, i) => value !== dependencies[i])) {
        memo = factory();
        dependencies = deps;
        pendingEffect = true;
      }
      return memo;
    },
    useRef: () => ref,
    useSyncExternalStore: (_: unknown, snapshot: () => unknown) => snapshot(),
    useEffect(callback: () => void | (() => void)) {
      if (pendingEffect) effect = callback;
    },
  };
  const loadedPlayer = load(
    path + 'visualization-player.tsx',
    {
      react: shim,
      '../../lib/visualizations/playback-controller': {
        ...playback,
        createPlaybackController(input: playback.PlaybackInput) {
          const store = playback.createPlaybackController(input, {
            schedule(callback) {
              timers.push(callback);
              return timers.length;
            },
            cancel() {},
          });
          stores.push(store);
          return store;
        },
      },
    },
    { document: doc, window: { matchMedia: () => motion } },
  );
  const render = loadedPlayer.VisualizationPlayer as (
    input: VisualizationPlayerProps,
  ) => React.ReactElement<{
    children: React.ReactElement<{
      state: playback.PlaybackState;
      onAction: (action: playback.PlaybackAction) => void;
    }>[];
  }>;
  const draw = (input: VisualizationPlayerProps) => {
    const result = render(input);
    if (pendingEffect) {
      cleanup?.();
      cleanup = effect?.() || undefined;
      pendingEffect = false;
    }
    return result.props.children[0]!.props;
  };
  let current = props;
  draw(current);
  draw(current).onAction('primary');
  assert.equal(draw(current).state.mode, 'playing');
  for (const replacement of [
    { ...current, accountKey: 'new-account' },
    { ...current, visualizationKey: 'new-graph' },
    { ...current, accountKey: 'a:b', visualizationKey: 'c' },
    { ...current, accountKey: 'a', visualizationKey: 'b:c' },
    { ...current, data: { ...graph } },
  ]) {
    current = replacement;
    assert.equal(draw(current).state.selectedStepIndex, null);
    timers.forEach((callback) => callback());
    assert.equal(draw(current).state.mode, 'overview');
    draw(current).onAction('primary');
  }
  const logout = { ...current, accountKey: '' };
  assert.equal(draw(logout).state.mode, 'unavailable');
  timers.forEach((callback) => callback());
  assert.equal(draw(logout).state.selectedStepIndex, null);
  assert.equal(stores.at(-1)!.data, null);
  cleanup?.();
});

test('F028 route guard reads exact server flag per call and rejects before fixture render', () => {
  const source = read('../src/app/(test)/test/visualizations/page.tsx');
  assert.match(source, /export const dynamic = 'force-dynamic'/);
  assert.doesNotMatch(source, /NEXT_PUBLIC|fetch\(|await |Suspense/);
  const old = process.env.DEEPLEARNER_BROWSER_FIXTURE;
  const denied = Symbol('404');
  const exports = load('../src/app/(test)/test/visualizations/page.tsx', {
    'next/navigation': {
      notFound() {
        throw denied;
      },
    },
    './fixture-client': {
      VisualizationFixture: () => React.createElement('p', null, 'Synthetic'),
    },
  });
  const Page = exports.default as () => React.ReactElement;
  try {
    for (const value of [undefined, '', '0', 'true', ' 1', '1 ']) {
      if (value === undefined) delete process.env.DEEPLEARNER_BROWSER_FIXTURE;
      else process.env.DEEPLEARNER_BROWSER_FIXTURE = value;
      assert.throws(Page, (error) => error === denied);
    }
    process.env.DEEPLEARNER_BROWSER_FIXTURE = '1';
    assert.ok(React.isValidElement(Page()));
    delete process.env.DEEPLEARNER_BROWSER_FIXTURE;
    assert.throws(Page, (error) => error === denied);
  } finally {
    if (old === undefined) delete process.env.DEEPLEARNER_BROWSER_FIXTURE;
    else process.env.DEEPLEARNER_BROWSER_FIXTURE = old;
  }
});

test('F028 fixture/config are synthetic, opt-in and retain loopback production server', () => {
  const fixture = read(
    '../src/app/(test)/test/visualizations/fixture-client.tsx',
  );
  assert.doesNotMatch(
    fixture,
    /process\.env|fetch\(|localStorage|dangerouslySetInnerHTML/,
  );
  const config = read('../../../playwright.f024.config.ts');
  assert.match(config, /concept-revise\.spec\.ts/);
  assert.match(config, /visualization-controls\.spec\.ts/);
  assert.match(config, /process\.env\.DEEPLEARNER_BROWSER_FIXTURE === '1'/);
  assert.match(config, /--hostname 127\.0\.0\.1/);
  assert.match(config, /reuseExistingServer: false/);
  const css = read(
    '../src/components/visualizations/visualization-controls.module.css',
  );
  assert.match(css, /flex-wrap: wrap/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /animation:|transition:|scroll-behavior/);
});
