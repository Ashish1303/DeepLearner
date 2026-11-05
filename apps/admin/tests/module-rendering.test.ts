import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { ModuleState } from '../src/lib/modules/module-controller';
const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL('../src/components/modules/module-inspector.tsx', import.meta.url),
  'utf8',
);
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const exports: Record<string, unknown> = {};
new Function('require', 'exports', output)((name: string) => {
  if (name === 'react' || name === 'react/jsx-runtime') return require(name);
  if (name.endsWith('.css'))
    return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
  if (name === '../../lib/modules/module-controller') return {};
  throw Error('Unexpected rendering import');
}, exports);
const View = exports.ModuleView as React.ComponentType<{
  state: ModuleState;
  disabled: boolean;
  list: (p: number) => void;
  detail: (id: string) => void;
  retry: () => void;
}>;
const item = {
  id: 'c'.repeat(24),
  technologyId: 'a'.repeat(24),
  learningPathId: 'b'.repeat(24),
  title: '<img src=x onerror=bad>',
  slug: 'module',
  description: null,
  status: 'DRAFT' as const,
  order: 0,
  revision: 0,
  createdAt: '2026-11-05T00:00:00.000Z',
  updatedAt: '2026-11-05T00:00:00.000Z',
};
const state: ModuleState = {
  status: 'ready',
  page: {
    items: [item],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
  detail: item,
  message: '',
};
const render = (next = state, disabled = false) =>
  renderToStaticMarkup(
    React.createElement(View, {
      state: next,
      disabled,
      list: () => {},
      detail: () => {},
      retry: () => {},
    }),
  );
test('module pane renders escaped read-only detail and semantic paging with no authoring controls', () => {
  const html = render();
  assert(html.includes('aria-labelledby="module-inventory-heading"'));
  assert(html.includes('aria-label="Module pages"'));
  assert(html.includes('&lt;img'));
  assert(!html.includes('<img'));
  assert(!/<(input|textarea|form|select)\b/.test(html));
  assert(!/<button[^>]*>(Save|Publish|Approve|Delete|Generate)/.test(html));
  assert(html.includes('Read-only'));
});
test('all stored statuses remain read-only', () => {
  for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const) {
    assert(
      render({ ...state, detail: { ...item, status } }).includes(
        status + ' · Read-only',
      ),
    );
  }
});
test('loading, empty, error and denied guidance is accessible and controls are bounded', () => {
  const loading = render({ ...state, status: 'loading', detail: null });
  assert(loading.includes('aria-busy="true"'));
  assert.match(loading, /<button[^>]*disabled=""[^>]*>Refresh Modules/);
  assert(
    render({
      ...state,
      status: 'error',
      page: null,
      detail: null,
      message: 'Unavailable',
    }).includes('Retry Module read'),
  );
  assert(
    render({ ...state, status: 'denied', page: null, detail: null }).includes(
      'role="alert"',
    ),
  );
  assert(
    render({
      ...state,
      page: {
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
      detail: null,
      message: 'No Modules on this page.',
    }).includes('No Modules'),
  );
  assert.match(
    render(state, true),
    /<button[^>]*disabled=""[^>]*>Refresh Modules/,
  );
});

test('mounting Module pane is inert until explicit Load and disconnects on unmount', () => {
  const effects: (() => () => void)[] = [];
  let reads = 0,
    connected = 0;
  const controller = {
    subscribe: () => () => {},
    getSnapshot: () => state,
    getServerSnapshot: () => state,
    connect: () => {
      connected++;
      return () => {
        connected--;
      };
    },
    list: () => {
      reads++;
    },
    detail: () => {},
    retry: () => {},
  };
  const isolated: Record<string, unknown> = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === 'react')
      return {
        useState: (factory: () => unknown) => [factory()],
        useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
          snapshot(),
        useEffect: (effect: () => () => void) => effects.push(effect),
      };
    if (name === 'react/jsx-runtime') return require(name);
    if (name.endsWith('.css')) return { default: {} };
    if (name === '../../lib/modules/module-controller')
      return { createModuleController: () => controller };
    throw Error('Unexpected hook import');
  }, isolated);
  const Inspector = isolated.ModuleInspector as (
    props: Record<string, unknown>,
  ) => unknown;
  Inspector({
    auth: {},
    accountId: 'd'.repeat(24),
    technologyId: item.technologyId,
    learningPathId: item.learningPathId,
    disabled: false,
  });
  assert.equal(reads, 0);
  const disconnect = effects[0]!();
  assert.equal(connected, 1);
  assert.equal(reads, 0);
  disconnect();
  assert.equal(connected, 0);
});
