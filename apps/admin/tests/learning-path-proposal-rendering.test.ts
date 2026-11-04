import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as contracts from '../src/lib/learning-path-proposals/contracts';
import * as controllers from '../src/lib/learning-path-proposals/proposal-controller';
import type { ProposalState } from '../src/lib/learning-path-proposals/proposal-controller';
import type { AdminController } from '../src/lib/auth/admin-controller';
import type { Technology } from '../src/lib/technologies/contracts';
const require = createRequire(import.meta.url);
const parent: Technology = {
  id: 'a'.repeat(24),
  name: 'Synthetic <script>',
  slug: 'synthetic',
  description: null,
  iconAssetId: null,
  status: 'DRAFT',
  revision: 0,
  order: 0,
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};
const initial: ProposalState = {
  status: 'editing',
  open: true,
  parent,
  draft: contracts.emptyDraft(),
  dirty: false,
  result: null,
  message: '',
  errors: {},
};
const auth = {
  hasTechnologyUncertainty: () => false,
  getProposalIntent: () => ({ phase: 'none' }),
} as unknown as AdminController;
function load(
  state = initial,
  overrides: Record<string, unknown> = {},
  react: unknown = React,
  document: unknown = {},
  HTMLElement: unknown = class {},
) {
  const out: Record<string, unknown> = {};
  const effects: (() => void)[] = [];
  const controller = {
    getSnapshot: () => state,
    setParent() {},
    isBusy: () => ['saving', 'reconciling'].includes(state.status),
    canEdit: () => ['editing', 'refused'].includes(state.status),
    needsWarning: () => state.dirty,
    edit() {},
    save() {},
    recover() {},
    detail() {},
    leave: () => true,
    open() {},
    ...overrides,
  };
  const source = readFileSync(
    new URL(
      '../src/components/learning-paths/learning-path-proposal-form.tsx',
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
  new Function('require', 'exports', 'document', 'HTMLElement', js)(
    (name: string) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../lib/learning-path-proposals/contracts')
        return contracts;
      if (name === '../../hooks/use-learning-path-proposal')
        return { useLearningPathProposal: () => ({ state, controller }) };
      if (name.endsWith('.module.css'))
        return {
          __esModule: true,
          default: new Proxy({}, { get: (_, key) => String(key) }),
        };
      throw Error('Unexpected rendering import');
    },
    out,
    document,
    HTMLElement,
  );
  void effects;
  return out.LearningPathProposalForm as (props: {
    auth: AdminController;
    accountId: string;
    parent: typeof parent | null;
    registerNavigation?: (guard: unknown) => void;
  }) => React.ReactElement;
}
const render = (state = initial, selected: typeof parent | null = parent) =>
  renderToStaticMarkup(
    React.createElement(load(state), {
      auth,
      accountId: 'f'.repeat(24),
      parent: selected,
    }),
  );
test('actual form renders labelled required fields, null choices, bounded ordered rows and memory disclosure', () => {
  const html = render();
  for (const text of [
    'Private Learning Path proposal',
    'id="proposal-title"',
    'for="proposal-title"',
    'maxLength="120"',
    'maxLength="500"',
    'Select depth',
    'Specify runtime',
    'No Technology version',
    'Objectives (1–20',
    'Prerequisites (0–20',
    'Save private proposal',
    'not guaranteed',
    'operator reconciliation',
    'noValidate',
    'aria-describedby="proposal-fields-note"',
  ])
    assert(html.includes(text), text);
  for (const bad of [
    '<script>',
    'textarea',
    'type="password"',
    'Generate curriculum',
    'Approve proposal',
    'Publish proposal',
    'Delete proposal',
    'operationId',
    'accessToken',
  ])
    assert(!html.includes(bad), bad);
});
test('field validation errors have safe fixed associated text and aria-invalid', () => {
  const html = render({
    ...initial,
    errors: { title: 'Enter a valid field.' },
    message: 'Check the highlighted brief fields.',
  });
  assert(html.includes('aria-invalid="true"'));
  assert(html.includes('proposal-error-title'));
  assert(html.includes('Check the highlighted'));
});
for (const status of ['saving', 'reconciling'] as const)
  test(
    status +
      ' disables editing, Save and ordinary Back while retaining bounded status',
    () => {
      const html = render({
        ...initial,
        status,
        message: 'Operation in progress',
      });
      assert(html.includes('aria-busy="true"'));
      assert(html.includes('Logout remains available'));
      assert(/disabled=""[^>]*>Back to inventory/.test(html));
      assert(!/<button type="submit">/.test(html));
    },
  );
test('archived/missing parent disables creation without creating a new workflow', () => {
  const archived = render(
    { ...initial, open: false, parent: { ...parent, status: 'ARCHIVED' } },
    { ...parent, status: 'ARCHIVED' },
  );
  assert(archived.includes('creation is unavailable'));
  assert(/disabled=""[^>]*>Create private proposal/.test(archived));
  const missing = render({ ...initial, open: false, parent: null }, null);
  assert(missing.includes('Select a Technology'));
  assert(!missing.includes('<form'));
});
test('strict private result renders explicit escaped DTO values and noneditorial status', () => {
  const result = {
    id: 'b'.repeat(24),
    proposalId: 'c'.repeat(24),
    technologyId: parent.id,
    revision: 1,
    schemaVersion: 1 as const,
    ...contracts.contentSchema.parse({
      ...initial.draft,
      title: '<script>private</script>',
      audience: 'Readers',
      depth: 'BEGINNER',
      objectives: ['<img>Goal'],
    }),
    source: { id: 'c'.repeat(24), revision: 1 },
    createdAt: parent.createdAt,
  };
  const html = render({ ...initial, status: 'saved', result });
  assert(html.includes('&lt;script&gt;'));
  assert(html.includes('&lt;img&gt;'));
  assert(html.includes('Private proposal — not approved or published'));
  assert(html.includes('Refresh private result'));
  assert(html.includes('New private proposal'));
  assert(!html.includes('definitionDigest'));
  assert(!html.includes('<form'));
});
test('uncertain and context-lost guidance cannot expose a Save or reset control', () => {
  for (const status of ['uncertain', 'unresolved', 'context-lost'] as const) {
    const html = render({ ...initial, status, message: 'Do not repeat Save.' });
    assert(html.includes('role="alert"'));
    assert(!html.includes('Save private proposal'));
    assert(!html.includes('Start over'));
  }
});
test('actual hook is passive, connects reversibly and adds unload warning only while needed', () => {
  const effects: (() => void | (() => void))[] = [];
  let added = 0,
    removed = 0;
  const window = {
    addEventListener(name: string) {
      assert.equal(name, 'beforeunload');
      added++;
    },
    removeEventListener(name: string) {
      assert.equal(name, 'beforeunload');
      removed++;
    },
  };
  let subscribed = 0,
    calls = 0;
  const fake = {
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
      subscribed++;
      return () => {
        subscribed--;
      };
    },
    getProposalIntent: () => ({ phase: 'none' }),
    hasTechnologyUncertainty: () => false,
    requestProposal() {
      calls++;
      throw Error('No request from mount');
    },
  };
  const source = readFileSync(
    new URL('../src/hooks/use-learning-path-proposal.ts', import.meta.url),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const out: Record<string, unknown> = {};
  new Function('require', 'exports', 'window', js)(
    (name: string) =>
      name === 'react'
        ? {
            useState: (f: () => unknown) => [f()],
            useSyncExternalStore: (_s: unknown, get: () => unknown) => get(),
            useEffect: (fn: () => void) => effects.push(fn),
          }
        : controllers,
    out,
    window,
  );
  const hook = out.useLearningPathProposal as (
    a: unknown,
    id: string,
  ) => { controller: ReturnType<typeof controllers.createProposalController> };
  const value = hook(fake, 'f'.repeat(24));
  assert.equal(calls, 0);
  const clean = effects.map((f) => f());
  assert.equal(subscribed, 1);
  assert.equal(added, 0);
  value.controller.setParent(parent);
  value.controller.open();
  value.controller.edit({ ...initial.draft, title: 'Dirty' });
  const warningCleanup = effects[1]!();
  assert.equal(added, 1);
  if (typeof warningCleanup === 'function') warningCleanup();
  clean.forEach((f) => {
    if (typeof f === 'function') f();
  });
  assert.equal(subscribed, 0);
  assert.equal(removed, 1);
  value.controller.dispose();
});
test('CSS provides wrapping, narrow single-column layout, local bounds and visible focus without fixed overlays', () => {
  const css = readFileSync(
    new URL(
      '../src/components/learning-paths/learning-path-proposal-form.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  for (const fragment of [
    'min-width: 0',
    'max-width: 100%',
    'min-height: 44px',
    'flex-wrap: wrap',
    'overflow-wrap: anywhere',
    ':focus-visible',
    'outline-offset',
    '@media',
    'minmax(0, 1fr)',
    'var(--studio-',
  ])
    assert(css.includes(fragment), fragment);
  assert(!/position:\s*fixed|@import|https?:/.test(css));
  // Source checks do not prove actual viewport, keyboard, contrast or screen-reader behavior.
});
test('actual dirty navigation guard requires explicit choice and refuses navigation during pending Save', () => {
  for (const status of ['editing', 'saving'] as const) {
    let state: ProposalState = { ...initial, status, dirty: true },
      index = 0,
      leaves = 0,
      moves = 0;
    const values: unknown[] = [],
      effects: (() => void)[] = [];
    const react = {
      useRef: (current: unknown) => ({ current }),
      useState: (value: unknown) => {
        const i = index++;
        if (!(i in values))
          values[i] =
            typeof value === 'function' ? (value as () => unknown)() : value;
        return [
          values[i],
          (next: unknown) => {
            values[i] =
              typeof next === 'function'
                ? (next as (v: unknown) => unknown)(values[i])
                : next;
          },
        ];
      },
      useEffect: (fn: () => void) => effects.push(fn),
    };
    const Component = load(
      state,
      {
        getSnapshot: () => state,
        leave: () => {
          leaves++;
          return true;
        },
      },
      react,
    );
    let guard: ((action: () => void) => void) | undefined;
    Component({
      auth,
      accountId: 'f'.repeat(24),
      parent,
      registerNavigation: (value) => {
        guard = value as typeof guard;
      },
    });
    effects[1]!();
    assert(guard);
    guard(() => {
      moves++;
    });
    assert.equal(moves, 0);
    assert.equal(leaves, 0);
    if (status === 'saving') {
      assert.equal(values[0], null);
      continue;
    }
    assert.equal(typeof values[0], 'function');
    index = 0;
    const tree = Component({ auth, accountId: 'f'.repeat(24), parent });
    const buttons: React.ReactElement<Record<string, unknown>>[] = [];
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (React.isValidElement<Record<string, unknown>>(node)) {
        if (node.type === 'button') buttons.push(node);
        walk(node.props.children);
      }
    };
    walk(tree);
    const keep = buttons.find((b) => b.props.children === 'Keep editing');
    assert(keep);
    (keep.props.onClick as () => void)();
    assert.equal(moves, 0);
    assert.equal(values[0], null);
    guard(() => {
      moves++;
    });
    index = 0;
    const again = Component({ auth, accountId: 'f'.repeat(24), parent });
    buttons.length = 0;
    walk(again);
    const discard = buttons.find((b) => b.props.children === 'Discard draft');
    assert(discard);
    (discard.props.onClick as () => void)();
    assert.equal(leaves, 1);
    assert.equal(moves, 1);
    state = { ...state, dirty: false };
  }
});
