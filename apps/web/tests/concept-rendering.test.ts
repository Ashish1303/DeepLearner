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
import * as contracts from '../src/lib/concepts/contracts';
import * as routes from '../src/lib/learning-paths/routes';
import { ConceptMarkdown } from '../src/components/concepts/concept-markdown';
import type { ConceptState } from '../src/lib/concepts/concept-controller';
const id = 'd'.repeat(24);
const ready: ConceptState = {
  status: 'ready',
  page: 1,
  message: '',
  invalidRequest: false,
  focusRevision: 0,
  data: {
    topic: {
      id,
      technologyId: 'a'.repeat(24),
      learningPathId: 'b'.repeat(24),
      moduleId: 'c'.repeat(24),
      title: 'Topic',
      slug: 'topic',
      description: null,
      order: 0,
    },
    crumbs: [],
    concept: null,
    items: [],
    totalPages: 0,
  },
};
// Static markup and handler wiring only. Mounted refs/effects are covered by the gated Playwright suite.
function fixture(
  state: ConceptState,
  resource: contracts.ConceptResource = 'topic',
  owner = 'one',
  role = 'STUDENT',
) {
  const require = createRequire(import.meta.url);
  const calls: unknown[] = [];
  const exports: {
    ConceptContents?: (props: {
      resource: contracts.ConceptResource;
      id: string;
    }) => ReactElement;
    ConceptBrowser?: (props: {
      resource: contracts.ConceptResource;
      id: string;
    }) => ReactElement | null;
  } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/concepts/concept-browser.tsx',
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
        useAuth: () => ({
          state: { status: 'authenticated', user: { id: owner, role } },
        }),
      };
    if (name === '../../hooks/use-concept-browser')
      return {
        useConceptBrowser: () => ({
          state,
          controller: {
            retry: () => calls.push('retry'),
            load: (page: number, explicit: boolean) =>
              calls.push([page, explicit]),
          },
        }),
      };
    if (name === '../../lib/concepts/contracts') return contracts;
    if (name === '../../lib/learning-paths/routes') return routes;
    if (name === './concept-markdown') return { ConceptMarkdown };
    if (name === './concept-browser.module.css') return {};
    throw Error('Unexpected fixture import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  assert(exports.ConceptContents && exports.ConceptBrowser);
  const element = exports.ConceptContents({ resource, id });
  const buttons: {
    children?: ReactNode;
    onClick(): void;
    disabled?: boolean;
  }[] = [];
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          onClick(): void;
          disabled?: boolean;
        }>(child)
      )
        return;
      if (child.type === 'button') buttons.push(child.props);
      visit(child.props.children);
    });
  }
  visit(element);
  return {
    html: renderToStaticMarkup(element),
    buttons,
    calls,
    owner: exports.ConceptBrowser({ resource, id }),
  };
}
test('empty later page announces truthfully and wires explicit page-1 recovery', () => {
  const result = fixture({
    ...ready,
    page: 2,
    data: { ...ready.data!, totalPages: 1 },
  });
  assert(result.html.includes('The requested page has no results.'));
  assert(!result.html.includes('Page 2 of 1'));
  result.buttons
    .find((button) => button.children === 'Return to page 1')!
    .onClick();
  assert.deepEqual(result.calls, [[1, true]]);
});
test('Previous/Next and Retry wire to explicit controller actions without claiming mounted behavior', () => {
  const result = fixture({
    ...ready,
    page: 2,
    data: { ...ready.data!, totalPages: 3 },
  });
  for (const label of ['Previous', 'Next'])
    result.buttons.find((button) => button.children === label)!.onClick();
  assert.deepEqual(result.calls, [
    [1, true],
    [3, true],
  ]);
  const error = fixture({
    ...ready,
    status: 'error',
    data: null,
    message: 'Try later',
  });
  error.buttons.find((button) => button.children === 'Retry')!.onClick();
  assert.deepEqual(error.calls, ['retry']);
  assert(error.html.includes('role="alert"'));
  assert(
    fixture({ ...ready, status: 'loading', page: 2, data: null }).buttons.every(
      (button) => button.disabled,
    ),
  );
});
test('owner/resource keys isolate content and ADMIN has no Concept component', () => {
  assert.notEqual(
    fixture(ready, 'topic', 'one').owner?.key,
    fixture(ready, 'topic', 'two').owner?.key,
  );
  assert.notEqual(
    fixture(ready, 'topic').owner?.key,
    fixture(ready, 'concept').owner?.key,
  );
  assert.equal(fixture(ready, 'topic', 'one', 'ADMIN').owner, null);
});
test('detail renders one page title, escaped summary, Read and source without progress controls', () => {
  const concept: contracts.Concept = {
    id: 'e'.repeat(24),
    technologyId: 'a'.repeat(24),
    learningPathId: 'b'.repeat(24),
    moduleId: 'c'.repeat(24),
    topicId: id,
    title: 'Concept',
    slug: 'concept',
    difficulty: 'BEGINNER',
    order: 0,
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: {
      summary: '<script>summary</script>',
      bodyMarkdown: '# Definition\n\nText',
    },
    source: {
      label: 'Reference',
      url: 'https://example.invalid/docs',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
  };
  const { html } = fixture(
    { ...ready, data: { ...ready.data!, concept } },
    'concept',
  );
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert(html.includes('&lt;script&gt;summary'));
  assert(!html.includes('<script>'));
  assert(html.includes('<h3>Definition</h3>'));
  assert(html.includes('noopener noreferrer'));
  assert(html.includes('Back to Topic'));
  for (const text of ['Mark complete', 'Start learning', 'Practice', 'XP'])
    assert(!html.includes(text));
});
