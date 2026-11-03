import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { LearningPathState } from '../src/lib/learning-paths/learning-path-controller';
import * as controllerModule from '../src/lib/learning-paths/learning-path-controller';
import type { AdminController } from '../src/lib/auth/admin-controller';

const require = createRequire(import.meta.url);
test('actual hook starts one bounded chooser read and disconnects subscriptions and late work', async () => {
  const source = readFileSync(
    new URL('../src/hooks/use-learning-paths.ts', import.meta.url),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const effects: (() => void | (() => void))[] = [];
  const exports: Record<string, unknown> = {};
  new Function('require', 'exports', js)((name: string) => {
    if (name === 'react')
      return {
        useState: (factory: () => unknown) => [factory()],
        useSyncExternalStore: (
          _subscribe: unknown,
          getSnapshot: () => unknown,
        ) => getSnapshot(),
        useEffect: (effect: () => void | (() => void)) => effects.push(effect),
      };
    if (name === '../lib/learning-paths/learning-path-controller')
      return controllerModule;
    throw Error('Unexpected hook dependency');
  }, exports);
  let listeners = 0,
    calls = 0;
  let signal: AbortSignal | undefined;
  let resolve!: (value: unknown) => void;
  const delayed = new Promise((resolveValue) => {
    resolve = resolveValue;
  });
  const auth = {
    getSnapshot: () => ({
      status: 'eligible',
      pending: false,
      user: {
        id: 'f'.repeat(24),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    }),
    subscribe() {
      listeners++;
      return () => {
        listeners--;
      };
    },
    async requestTechnology(
      _account: string,
      request: unknown,
      ownedSignal: AbortSignal,
    ) {
      calls++;
      signal = ownedSignal;
      assert.deepEqual(request, {
        kind: 'list',
        query: { page: 1, limit: 20 },
      });
      return delayed;
    },
  } as unknown as AdminController;
  const hook = exports.useLearningPaths as (
    auth: AdminController,
    id: string,
  ) => {
    controller: ReturnType<
      typeof controllerModule.createLearningPathController
    >;
  };
  const resource = hook(auth, 'f'.repeat(24));
  assert.equal(calls, 0);
  const cleanup = effects[0]!();
  assert.equal(calls, 1);
  assert.equal(listeners, 1);
  assert.equal(typeof cleanup, 'function');
  (cleanup as () => void)();
  assert(signal?.aborted);
  assert.equal(listeners, 0);
  resolve({ items: [parent], pagination });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resource.controller.getSnapshot().parents, null);
  resource.controller.dispose();
});
const parent = {
  id: 'a'.repeat(24),
  name: 'Synthetic <script>',
  slug: 'synthetic',
  status: 'ARCHIVED' as const,
  description: null,
  iconAssetId: null,
  order: 0,
  revision: 0,
  createdAt: '2026-11-03T00:00:00.000Z',
  updatedAt: '2026-11-03T00:00:00.000Z',
};
const item = {
  id: 'b'.repeat(24),
  technologyId: parent.id,
  title: '<img src=x onerror=alert(1)>',
  slug: 'path',
  status: 'DRAFT' as const,
  description: '<script>synthetic</script>',
  targetLevel: null,
  completionScore: 80,
  order: 0,
  revision: 2,
  createdAt: parent.createdAt,
  updatedAt: parent.updatedAt,
};
const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
const state: LearningPathState = {
  status: 'ready',
  parents: { items: [parent], pagination },
  parentPage: 1,
  parent,
  paths: { items: [item], pagination },
  page: 1,
  detail: item,
  selected: item.id,
  message: '',
};
function load(
  snapshot: LearningPathState = state,
  actions: Record<string, unknown> = {},
) {
  const source = readFileSync(
    new URL(
      '../src/components/learning-paths/learning-path-manager.tsx',
      import.meta.url,
    ),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const out: Record<string, unknown> = {};
  new Function('require', 'exports', js)((name: string) => {
    if (name === 'react/jsx-runtime') return require(name);
    if (name === '../../hooks/use-learning-paths')
      return {
        useLearningPaths: () => ({
          state: snapshot,
          controller: {
            refresh() {},
            retry() {},
            parents() {},
            paths() {},
            detail() {},
            selectTechnology() {},
            ...actions,
          },
        }),
      };
    if (name.endsWith('.module.css'))
      return {
        __esModule: true,
        default: new Proxy({}, { get: (_target, key) => String(key) }),
      };
    throw Error('Unexpected render dependency');
  }, out);
  return out.LearningPathManager as (props: {
    auth: never;
    accountId: string;
  }) => React.ReactElement;
}
const render = (snapshot = state) =>
  renderToStaticMarkup(
    React.createElement(load(snapshot), {
      auth: {} as never,
      accountId: 'f'.repeat(24),
    }),
  );
test('read-only semantic inventory escapes text and exposes no unavailable action controls', () => {
  const html = render();
  for (const text of [
    'Learning Paths',
    'Select a Technology',
    'Learning Path inventory, page 1',
    'scope="col"',
    'scope="row"',
    'role="region"',
    'tabindex="0"',
    'Read-only Learning Path',
    'Configured completion threshold',
    'Not specified',
    'datetime="2026-11-03',
    '&lt;img',
    '&lt;script',
    'Archived Technology',
  ])
    assert(html.toLowerCase().includes(text.toLowerCase()), text);
  for (const unsafe of [
    '<script>',
    '<img',
    '<form',
    'Save draft',
    'Create draft',
    'Publish',
    'Delete',
    'Generate',
    'Approve',
  ])
    assert(!html.includes(unsafe), unsafe);
});
for (const status of ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const)
  test(status + ' is visible without mutation controls', () => {
    const html = render({ ...state, detail: { ...item, status } });
    assert(html.includes(status));
    assert(!html.includes('<input'));
    assert(!html.includes('<select'));
  });
for (const status of [
  'loading-parents',
  'loading-paths',
  'loading-detail',
] as const)
  test(status + ' announces loading and blocks Refresh', () => {
    const html = render({ ...state, status, detail: null });
    assert(html.includes('role="status"'));
    assert(html.includes('aria-busy="true"'));
    assert.match(html, /<button[^>]*disabled=""[^>]*>Refresh/);
  });
test('no selection and parent-empty states do not manufacture child content', () => {
  const html = render({
    ...state,
    parent: null,
    paths: null,
    detail: null,
    parents: {
      items: [],
      pagination: { ...pagination, total: 0, totalPages: 0 },
    },
    message: 'No Technologies on this page.',
  });
  assert(html.includes('No Technologies'));
  assert(!html.includes('path-inventory-heading'));
});
test('empty later page preserves Previous and disables Next', () => {
  const html = render({
    ...state,
    page: 2,
    paths: { items: [], pagination: { ...pagination, page: 2 } },
    detail: null,
    selected: null,
    message: 'No Learning Paths on this page.',
  });
  assert.match(html, /<button type="button">Previous Learning Paths/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Next Learning Paths/);
  assert(html.includes('No Learning Paths'));
});
test('error and denied states render fixed guidance and explicit retry only', () => {
  const error = render({
    ...state,
    status: 'error',
    detail: null,
    message: 'The response could not be verified.',
  });
  assert(error.includes('role="alert"'));
  assert(error.includes('Retry current read'));
  const denied = render({
    ...state,
    status: 'denied',
    parents: null,
    parent: null,
    paths: null,
    detail: null,
    message: '',
  });
  assert(denied.includes('Sign in again'));
  assert(!denied.includes('Retry current read'));
});
test('native chooser/detail/retry handlers invoke only the matching controller action', () => {
  const calls: unknown[] = [];
  const Component = load(state, {
    selectTechnology: (id: string) => calls.push(['parent', id]),
    detail: (id: string) => calls.push(['detail', id]),
    refresh: () => calls.push(['refresh']),
  });
  const tree = Component({ auth: {} as never, accountId: 'f'.repeat(24) });
  const buttons: React.ReactElement<{
    onClick?: () => void;
    children?: React.ReactNode;
  }>[] = [];
  const walk = (node: React.ReactNode) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (
      React.isValidElement<{
        children?: React.ReactNode;
        onClick?: () => void;
      }>(node)
    ) {
      if (node.type === 'button') buttons.push(node);
      walk(node.props.children);
    }
  };
  walk(tree);
  buttons.find((b) => b.props.children === 'Refresh')!.props.onClick!();
  buttons.find(
    (b) =>
      Array.isArray(b.props.children) &&
      React.isValidElement<{ children?: React.ReactNode }>(
        b.props.children[0],
      ) &&
      b.props.children[0].props.children === parent.name,
  )!.props.onClick!();
  buttons.find((b) => b.props.children === item.title)!.props.onClick!();
  assert.deepEqual(calls, [
    ['refresh'],
    ['parent', parent.id],
    ['detail', item.id],
  ]);
});
test('CSS contains bounded scroll, wrapping, responsive layout and visible keyboard focus', () => {
  const css = readFileSync(
    new URL(
      '../src/components/learning-paths/learning-path-manager.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  for (const rule of [
    'overflow-x: auto',
    'overflow-wrap: anywhere',
    ':focus-visible',
    '48rem',
    '24rem',
    'minmax(0, 1fr)',
    'var(--studio-',
  ])
    assert(css.includes(rule), rule);
  assert(!/@import|url\(|animation:/.test(css));
});
