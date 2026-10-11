import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as routes from '../src/lib/learning-paths/routes';
import type { LearningState } from '../src/lib/learning-paths/learning-browser-controller';
import { createLearningBrowserController } from '../src/lib/learning-paths/learning-browser-controller';
import { LearningError } from '../src/lib/api/learning-path-client';
const id = 'a'.repeat(24);
const initial: LearningState = {
  status: 'ready',
  page: 1,
  data: {
    title: 'A <path>',
    description: null,
    crumbs: [{ title: 'Explore technologies', href: '/explore-technologies' }],
    items: [],
    totalPages: 0,
  },
  message: '',
  invalidRequest: false,
  focusRevision: 0,
};
function fixture(
  state: LearningState,
  resource: routes.Resource = 'path',
  owner = 'one',
  role = 'STUDENT',
  status = 'authenticated',
  controller: Pick<
    ReturnType<typeof createLearningBrowserController>,
    'retry' | 'load'
  > = {
    retry: async () => {},
    load: async () => {},
  },
) {
  const require = createRequire(import.meta.url);
  const exports: {
    LearningContents?: (props: {
      resource: routes.Resource;
      id: string;
    }) => ReactElement;
    LearningBrowser?: (props: {
      resource: routes.Resource;
      id: string;
    }) => ReactElement | null;
  } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/learning-paths/learning-browser.tsx',
        import.meta.url,
      ),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const load = (name: string): unknown => {
    if (name === 'react')
      return { useEffect() {}, useRef: () => ({ current: null }) };
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'next/link')
      return {
        __esModule: true,
        default: (props: Record<string, unknown>) => createElement('a', props),
      };
    if (name === '../../hooks/use-auth')
      return {
        useAuth: () => ({ state: { status, user: { id: owner, role } } }),
      };
    if (name === '../../hooks/use-learning-browser')
      return {
        useLearningBrowser: () => ({
          state,
          controller,
        }),
      };
    if (name === '../../lib/learning-paths/routes') return routes;
    if (name === './learning-browser.module.css') return {};
    throw Error('Unexpected import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  assert(exports.LearningContents && exports.LearningBrowser);
  // Handler wiring only: no DOM mounting, effects, refs or browser event dispatch.
  const tree = exports.LearningContents({ resource, id });
  const buttons: ReactElement<{
    children?: ReactNode;
    disabled?: boolean;
    onClick: () => void;
  }>[] = [];
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          disabled?: boolean;
          onClick: () => void;
        }>(child)
      )
        return;
      if (child.type === 'button') buttons.push(child);
      visit(child.props.children);
    });
  }
  visit(tree);
  return {
    html: renderToStaticMarkup(
      createElement(exports.LearningContents, { resource, id }),
    ),
    element: exports.LearningBrowser({ resource, id }),
    button(label: string) {
      const matches = buttons.filter(
        (button) => button.props.children === label,
      );
      assert.equal(matches.length, 1, `Expected one ${label} button`);
      return matches[0]!.props;
    },
  };
}
test('metadata cards, breadcrumbs and topic overview remain safe and contain no learning actions', () => {
  const { html } = fixture({
    ...initial,
    data: {
      ...initial.data!,
      totalPages: 1,
      items: [
        {
          id,
          technologyId: id,
          learningPathId: id,
          title: '<Module>',
          slug: 'module',
          description: null,
          order: 0,
        },
      ],
    },
  });
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert(html.includes('aria-label="Breadcrumb"'));
  assert(html.includes('&lt;Module&gt;'));
  assert(html.includes('href="/modules/' + id + '"'));
  assert(html.includes('Description not available yet.'));
  const topic = fixture(initial, 'topic').html;
  assert(
    topic.includes('Learning content is not yet available for this topic.'),
  );
  assert(!topic.includes('pagination'));
  assert(!topic.includes('Start learning'));
  assert(!topic.includes('completionScore'));
});

test('Previous/Next handlers request adjacent pages through the real controller', async () => {
  const pages: number[] = [];
  const controller = createLearningBrowserController(
    {
      load: async (_resource, _id, page) => {
        pages.push(page);
        return { ...initial.data!, title: `Page ${page}`, totalPages: 3 };
      },
    },
    'path',
    id,
  );
  const render = () =>
    fixture(
      controller.getSnapshot(),
      'path',
      'one',
      'STUDENT',
      'authenticated',
      controller,
    );
  await controller.load();
  assert.equal(render().button('Previous').disabled, true);
  assert.equal(render().button('Next').disabled, false);
  render().button('Next').onClick();
  assert.equal(controller.getSnapshot().status, 'loading');
  assert.equal(render().button('Previous').disabled, true);
  assert.equal(render().button('Next').disabled, true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(controller.getSnapshot().page, 2);
  assert(render().html.includes('Page 2 of 3'));
  render().button('Previous').onClick();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(controller.getSnapshot().page, 1);
  assert.deepEqual(pages, [1, 2, 1]);
  // This asserts the focus request, not actual DOM focus.
  assert.equal(controller.getSnapshot().focusRevision, 2);
});

test('Retry handler retains the failed page and requests only after explicit activation', async () => {
  const pages: number[] = [];
  const controller = createLearningBrowserController(
    {
      load: async (_resource, _id, page) => {
        pages.push(page);
        if (pages.length === 1) throw new LearningError('unavailable');
        return { ...initial.data!, totalPages: 3 };
      },
    },
    'path',
    id,
  );
  const render = () =>
    fixture(
      controller.getSnapshot(),
      'path',
      'one',
      'STUDENT',
      'authenticated',
      controller,
    );
  await controller.load(2, true);
  assert.equal(controller.getSnapshot().status, 'error');
  const focus = controller.getSnapshot().focusRevision;
  render();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(pages, [2]);
  render().button('Retry').onClick();
  assert.equal(controller.getSnapshot().status, 'loading');
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(controller.getSnapshot().status, 'ready');
  assert.equal(controller.getSnapshot().page, 2);
  assert.equal(controller.getSnapshot().focusRevision, focus);
  assert.deepEqual(pages, [2, 2]);
});

test('empty-page and invalid-request recovery handlers explicitly request page 1', async () => {
  for (const invalid of [false, true]) {
    const pages: number[] = [];
    const controller = createLearningBrowserController(
      {
        load: async (_resource, _id, page) => {
          pages.push(page);
          if (invalid && page === 2) throw new LearningError('invalid');
          return { ...initial.data!, totalPages: 1 };
        },
      },
      'path',
      id,
    );
    const render = () =>
      fixture(
        controller.getSnapshot(),
        'path',
        'one',
        'STUDENT',
        'authenticated',
        controller,
      );
    await controller.load(2);
    render();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(pages, [2]);
    render().button('Return to page 1').onClick();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(controller.getSnapshot().page, 1);
    assert.equal(controller.getSnapshot().status, 'ready');
    assert.equal(controller.getSnapshot().focusRevision, 1);
    assert.deepEqual(pages, [2, 1]);
    assert(!render().html.includes('Return to page 1'));
  }
});
test('loading, errors and empty later pages announce truthful states and explicit recovery', () => {
  const loading = fixture({
    ...initial,
    status: 'loading',
    data: null,
    page: 2,
  }).html;
  assert(loading.includes('aria-busy="true"'));
  assert.equal((loading.match(/disabled=""/g) ?? []).length, 2);
  const empty = fixture({
    ...initial,
    page: 2,
    data: { ...initial.data!, totalPages: 1 },
  }).html;
  assert(empty.includes('The requested page has no results.'));
  assert(!empty.includes('Page 2 of 1'));
  assert(empty.includes('Return to page 1'));
  const error = fixture({
    ...initial,
    status: 'error',
    data: null,
    message: 'Please wait.',
    invalidRequest: true,
    page: 2,
  }).html;
  assert(error.includes('role="alert"'));
  assert(error.includes('Retry'));
  assert(error.includes('Return to page 1'));
});
test('ownership keys isolate routes and identities; ADMIN and unauthenticated content stays withheld', () => {
  assert.notEqual(
    fixture(initial, 'path', 'one').element?.key,
    fixture(initial, 'path', 'two').element?.key,
  );
  assert.notEqual(
    fixture(initial, 'path').element?.key,
    fixture(initial, 'module').element?.key,
  );
  assert.equal(fixture(initial, 'path', 'one', 'ADMIN').element, null);
  for (const status of ['anonymous', 'blocked', 'restoring', 'unsupported'])
    assert.equal(
      fixture(initial, 'path', 'one', 'STUDENT', status).element,
      null,
    );
});
