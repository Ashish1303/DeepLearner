import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as contracts from '../src/lib/technologies/contracts';
import type { TechnologyState } from '../src/lib/technologies/technology-controller';
import type { AdminController } from '../src/lib/auth/admin-controller';

// Server rendering with inert hook data only. These are not browser/UI acceptance.
const require = createRequire(import.meta.url);
const item: contracts.Technology = {
  id: 'a'.repeat(24),
  name: '<img src=x onerror=alert(1)>',
  slug: 'typescript',
  description: '<script>synthetic</script>',
  iconAssetId: null,
  status: 'DRAFT',
  order: 0,
  revision: 0,
  createdAt: '2026-10-30T00:00:00.000Z',
  updatedAt: '2026-10-30T00:00:00.000Z',
};
const state: TechnologyState = {
  status: 'ready',
  page: {
    items: [item],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
  detail: null,
  selected: null,
  query: { page: 1, limit: 20 },
  message: '',
  needsReconciliation: false,
};
function moduleFor(
  snapshot: TechnologyState = state,
  mode = 'none',
  hooks: Record<string, unknown> = {},
  actions: Record<string, unknown> = {},
) {
  const source = readFileSync(
    new URL(
      '../src/components/technologies/technology-manager.tsx',
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
  new Function('require', 'exports', 'document', js)(
    (name: string) => {
      if (name === 'react')
        return {
          ...React,
          useState: (initial: unknown) =>
            React.useState(initial === 'none' ? mode : initial),
          ...hooks,
        };
      if (name === 'react/jsx-runtime') return require(name);
      if (name === '../../hooks/use-technologies')
        return {
          useTechnologies: () => ({
            state: snapshot,
            controller: {
              list: async () => {},
              detail: async () => {},
              getSnapshot: () => snapshot,
              ...actions,
            },
          }),
        };
      if (name === '../../lib/technologies/contracts') return contracts;
      if (name.endsWith('.module.css'))
        return {
          __esModule: true,
          default: new Proxy({}, { get: (_target, key) => String(key) }),
        };
      throw Error('Unexpected rendering dependency');
    },
    out,
    { visibilityState: 'visible' },
  );
  return {
    ...out,
    validateTechnologyForm: contracts.validateTechnologyForm,
  } as {
    TechnologyManager: React.ComponentType<{
      auth: AdminController;
      accountId: string;
    }>;
    validateTechnologyForm: typeof contracts.validateTechnologyForm;
  };
}
function render(snapshot: TechnologyState = state, mode = 'none') {
  const { TechnologyManager } = moduleFor(snapshot, mode);
  return renderToStaticMarkup(
    React.createElement(TechnologyManager, {
      auth: {} as AdminController,
      accountId: 'b'.repeat(24),
    }),
  );
}
test('inventory is semantic, bounded and escapes untrusted names', () => {
  const html = render();
  for (const text of [
    'Technology inventory, page 1',
    'scope="col"',
    'scope="row"',
    'Technology pages',
    'dateTime="2026-10-30',
    '&lt;img',
    'DRAFT',
  ])
    assert(html.toLowerCase().includes(text.toLowerCase()));
  assert(!html.includes('<img'));
  assert(!html.includes('onerror="'));
  assert(!html.includes('Publish draft'));
  assert(!html.includes('Delete'));
});
test('draft editor includes labelled required fields and an immutable existing slug', () => {
  const html = render({ ...state, detail: item }, 'detail');
  for (const text of [
    'Edit draft Technology',
    'for="technology-name"',
    'for="technology-description"',
    'readonly=""',
    'Save draft changes',
    'Revision',
  ])
    assert(html.toLowerCase().includes(text.toLowerCase()), text);
  assert(!html.includes('<script>'));
});
for (const status of ['PUBLISHED', 'ARCHIVED'] as const)
  test(status + ' detail has no mutation form', () => {
    const html = render({ ...state, detail: { ...item, status } }, 'detail');
    assert(html.includes('Read-only Technology'));
    assert(!html.includes('Edit draft Technology'));
    assert(!html.includes('Save draft changes'));
    assert(html.includes('&lt;script&gt;'));
  });
test('new draft editor has a permanent-slug explanation and no status selector', () => {
  const html = render(state, 'create');
  assert(html.includes('Create draft Technology'));
  assert(html.includes('permanent unique identifier'));
  assert(!html.includes('<select'));
  assert(!html.includes('readonly=""'));
});
test('unknown write result removes editor and provides explicit read reconciliation', () => {
  const html = render(
    {
      ...state,
      status: 'uncertain',
      detail: null,
      message: 'This change could not be confirmed.',
      needsReconciliation: true,
      selected: item.id,
    },
    'detail',
  );
  for (const text of [
    'role="alert"',
    'Reload selected Technology',
    'Reload inventory to reconcile',
    'Do not resubmit',
  ])
    assert(html.includes(text));
  assert(!html.includes('<form'));
});
test('loading and saving expose status and cancellation while disabling duplicate creation', () => {
  for (const status of ['loading', 'saving'] as const) {
    const html = render({ ...state, status });
    assert(html.includes('aria-busy="true"'));
    assert(html.includes('disabled=""'));
    assert(
      html.includes(
        status === 'loading' ? 'Cancel loading' : 'Cancel change request',
      ),
    );
  }
});
test('empty state contains truthful guidance and no invented statistics', () => {
  const html = render({
    ...state,
    page: {
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  });
  assert(html.includes('No Technologies on this page'));
  assert(html.includes('0 Technologies'));
  assert(!html.includes('completion'));
});
test('field validation accepts valid create and immutable-slug edit values', () => {
  const { validateTechnologyForm: validate } = moduleFor();
  const fields = {
    name: ' Draft ',
    slug: 'draft-one',
    description: '',
    order: '0',
  };
  assert.deepEqual(validate(fields, null), {});
  assert.deepEqual(validate({ ...fields, slug: 'immutable' }, item), {});
});
for (const [field, value] of [
  ['name', ' '],
  ['name', 'x'.repeat(81)],
  ['slug', 'Uppercase'],
  ['slug', 'bad\n'],
  ['description', 'x'.repeat(2001)],
  ['order', '1e3'],
  ['order', '-1'],
  ['order', '9007199254740992'],
] as const)
  test(
    'invalid ' + field + ' is caught by form validation: ' + value.length,
    () => {
      const { validateTechnologyForm: validate } = moduleFor();
      assert(
        validate(
          {
            ...{ name: 'Draft', slug: 'draft', description: '', order: '0' },
            [field]: value,
          },
          null,
        )[field],
      );
    },
  );
test('responsive styles preserve focus visibility and do not depend on external assets', () => {
  const css = readFileSync(
    new URL(
      '../src/components/technologies/technology-manager.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  assert(css.includes('@media'));
  assert(css.includes(':focus-visible'));
  assert(!css.includes('@import'));
  assert(!css.includes('url('));
});

test('opening, closing and cancelling express deliberate focus intent without a browser', () => {
  const effects: (() => void)[] = [],
    focus: string[] = [];
  let refs = 0,
    cancelled = 0;
  // Assign stable per-ref identities; no document events or synthetic keyboard input.
  const hooks = {
    useState: (initial: unknown) => [
      initial === 'none' ? 'create' : initial,
      () => {},
    ],
    useRef: () => {
      const name = refs++ === 0 ? 'editor' : 'inventory';
      return { current: { focus: () => focus.push(name) } };
    },
    useEffect: (fn: () => void) => effects.push(fn),
  };
  const component = moduleFor(
    { ...state, status: 'loading' },
    'create',
    hooks,
    {
      cancel: () => {
        cancelled++;
      },
    },
  ).TechnologyManager as unknown as (props: {
    auth: AdminController;
    accountId: string;
  }) => React.ReactElement;
  const root = component({
    auth: {} as AdminController,
    accountId: 'b'.repeat(24),
  });
  const flatten = (
    node: unknown,
  ): React.ReactElement<Record<string, unknown>>[] =>
    Array.isArray(node)
      ? node.flatMap(flatten)
      : React.isValidElement<Record<string, unknown>>(node)
        ? [node, ...flatten(node.props.children)]
        : [];
  for (const effect of effects) effect();
  assert.deepEqual(focus, ['inventory', 'editor']);
  const elements = flatten(root);
  const close = elements.find(
    (el) => el.props['aria-label'] === 'Close Technology detail',
  );
  assert(close);
  (close.props.onClick as () => void)();
  assert.equal(focus.at(-1), 'inventory');
  const cancel = elements.find(
    (el) =>
      el.type === 'button' &&
      Array.isArray(el.props.children) &&
      el.props.children[0] === 'Cancel ',
  );
  assert(cancel);
  (cancel.props.onClick as () => void)();
  assert.equal(cancelled, 1);
  assert.equal(focus.at(-1), 'inventory');
});
test('Technology hook preserves an unresolved mutation until explicit reconciliation and disconnects owned work', () => {
  const source = readFileSync(
    new URL('../src/hooks/use-technologies.ts', import.meta.url),
    'utf8',
  );
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  for (const uncertain of [true, false]) {
    let lists = 0,
      disconnected = 0;
    const effects: (() => () => void)[] = [];
    const controller = {
      subscribe: () => () => {},
      getSnapshot: () => ({ needsReconciliation: uncertain }),
      getServerSnapshot: () => ({ needsReconciliation: uncertain }),
      connect: () => () => {
        disconnected++;
      },
      list: async () => {
        lists++;
      },
    };
    const out: Record<string, unknown> = {};
    new Function('require', 'exports', js)((name: string) => {
      if (name === 'react')
        return {
          useState: (create: () => unknown) => [create()],
          useSyncExternalStore: (
            _subscribe: unknown,
            snapshot: () => unknown,
          ) => snapshot(),
          useEffect: (effect: () => () => void) => effects.push(effect),
        };
      if (name === '../lib/technologies/technology-controller')
        return { createTechnologyController: () => controller };
      throw Error('Unexpected hook dependency');
    }, out);
    (out.useTechnologies as (auth: unknown, id: string) => unknown)(
      {},
      'b'.repeat(24),
    );
    assert.equal(lists, 0);
    const stop = effects[0]!();
    assert.equal(lists, uncertain ? 0 : 1);
    stop();
    assert.equal(disconnected, 1);
  }
});
