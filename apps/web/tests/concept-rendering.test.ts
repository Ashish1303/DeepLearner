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
  mode: 'read' | 'example' | 'revise' = 'read',
) {
  const require = createRequire(import.meta.url);
  const calls: unknown[] = [];
  const selections: unknown[] = [];
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
      return {
        useEffect() {},
        useRef: (value: unknown) => ({ current: value }),
        useId: () => 'test-tabs',
        useState: () => [mode, (value: unknown) => selections.push(value)],
      };
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
    if (name === './concept-progress')
      return {
        ConceptProgress: ({ conceptId }: { conceptId: string }) =>
          createElement(
            'section',
            {
              'aria-label': 'Saved practice activity',
              'data-concept-id': conceptId,
            },
            'Saved practice activity',
          ),
      };
    if (name === './concept-completion')
      return {
        ConceptCompletion: ({ conceptId }: { conceptId: string }) =>
          createElement('section', {
            'aria-label': 'Concept completion',
            'data-completion-concept-id': conceptId,
          }),
      };
    if (name === './concept-examples' || name === './concept-revise') {
      const nested = {};
      const source = readFileSync(
        new URL(
          '../src/components/concepts/' + name.slice(2) + '.tsx',
          import.meta.url,
        ),
        'utf8',
      );
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText;
      new Function('require', 'exports', output)(load, nested);
      return nested;
    }
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
    onKeyDown?: (event: { key: string; preventDefault(): void }) => void;
    disabled?: boolean;
  }[] = [];
  const links: {
    href: string;
    children?: ReactNode;
    tabIndex?: number;
    onClick?: () => void;
    onKeyDown?: (event: { key: string; preventDefault(): void }) => void;
  }[] = [];
  function visit(node: ReactNode) {
    Children.forEach(node, (child) => {
      if (
        !isValidElement<{
          children?: ReactNode;
          onClick(): void;
          disabled?: boolean;
          href?: string;
          tabIndex?: number;
          onKeyDown?: (event: { key: string; preventDefault(): void }) => void;
        }>(child)
      )
        return;
      if (child.type === 'button') buttons.push(child.props);
      if (typeof child.props.href === 'string')
        links.push({ ...child.props, href: child.props.href });
      visit(child.props.children);
    });
  }
  visit(element);
  return {
    html: renderToStaticMarkup(element),
    buttons,
    links,
    calls,
    selections,
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
    examples: [],
    revise: null,
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
  // F037 activity stays separate; the F038 panel receives this exact Concept.
  assert(html.includes('Saved practice activity'));
  assert(html.includes('aria-label="Concept completion"'));
  assert(html.includes(`data-completion-concept-id="${concept.id}"`));
  for (const text of ['Mark complete', 'Start learning', 'XP'])
    assert(!html.includes(text));
  for (const conceptId of [concept.id, 'f'.repeat(24)]) {
    const result = fixture(
      {
        ...ready,
        data: { ...ready.data!, concept: { ...concept, id: conceptId } },
      },
      'concept',
    );
    const links = result.links.filter(
      (link) => link.children === 'Practice output questions',
    );
    assert.equal(links.length, 1);
    assert.equal(links[0]!.href, `/concepts/${conceptId}/practice`);
    // A named native anchor participates in tab order and Enter navigation.
    // Mounted keyboard/focus behavior remains a separately gated browser check.
    assert.equal(links[0]!.tabIndex, undefined);
    assert.equal(links[0]!.onKeyDown, undefined);
    assert.equal(links[0]!.onClick, undefined);
    assert(
      result.html.includes(
        `<a href="/concepts/${conceptId}/practice">Practice output questions</a>`,
      ),
    );
  }
  assert(!fixture(ready, 'topic').html.includes('Practice output questions'));
  assert(!fixture(ready, 'topic').html.includes('Saved practice activity'));
  assert(
    !fixture(ready, 'topic').html.includes('aria-label="Concept completion"'),
  );
});

test('F025 source footer remains escaped, safe and below all three modes without fetches', () => {
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
    examples: [],
    revise: null,
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: { summary: 'Summary', bodyMarkdown: '# Read body' },
    source: {
      label: '<script>source</script>',
      url: 'https://example.invalid/docs?q=x#part',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
  };
  for (const mode of ['read', 'example', 'revise'] as const)
    for (const isOfficial of [false, true]) {
      const result = fixture(
        {
          ...ready,
          data: {
            ...ready.data!,
            concept: {
              ...concept,
              source: { ...concept.source, isOfficial },
            },
          },
        },
        'concept',
        'one',
        'STUDENT',
        mode,
      );
      const footer = result.html.slice(result.html.indexOf('<footer'));
      assert(footer.includes('<h2>Reference</h2>'));
      assert(
        footer.includes(isOfficial ? 'Official source' : 'Reference source'),
      );
      assert(footer.includes('&lt;script&gt;source&lt;/script&gt;'));
      assert(!footer.includes('<script>'));
      assert(footer.includes('href="https://example.invalid/docs?q=x#part"'));
      assert(footer.includes('target="_blank" rel="noopener noreferrer"'));
      assert(footer.includes('(opens in a new tab)'));
      assert(
        result.html.lastIndexOf('role="tabpanel"') <
          result.html.indexOf('<footer'),
      );
      assert.deepEqual(result.calls, []);
    }
  const unsafe = fixture(
    {
      ...ready,
      data: {
        ...ready.data!,
        concept: {
          ...concept,
          source: { ...concept.source, url: 'javascript:alert(1)' },
        },
      },
    },
    'concept',
  ).html;
  assert(!unsafe.includes('href="javascript:'));
  assert(unsafe.includes('&lt;script&gt;source&lt;/script&gt;'));
});

test('Read/Example static semantics, no-fetch selection wiring and ordered safe empty/content panels', () => {
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
    revise: null,
    contentFormat: 'MARKDOWN',
    schemaVersion: 1,
    read: { summary: 'Summary', bodyMarkdown: '# Read body' },
    source: {
      label: 'Source',
      url: 'https://example.invalid',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
    examples: [
      { title: 'First <script>', bodyMarkdown: '## Body one' },
      { title: 'Second', bodyMarkdown: '# Body two' },
    ],
  };
  const state = { ...ready, data: { ...ready.data!, concept } };
  const read = fixture(state, 'concept');
  assert(read.html.includes('role="tablist"'));
  assert(
    read.html.includes(
      'id="test-tabs-read-tab" aria-controls="test-tabs-read-panel" aria-selected="true" tabindex="0"',
    ),
  );
  assert(
    read.html.includes(
      'id="test-tabs-example-panel" aria-labelledby="test-tabs-example-tab" hidden=""',
    ),
  );
  read.buttons.find((button) => button.children === 'Example')!.onClick();
  assert.deepEqual(read.selections, ['example']);
  assert.deepEqual(read.calls, []);
  const example = fixture(state, 'concept', 'one', 'STUDENT', 'example').html;
  assert(example.includes('<h2>Example</h2>'));
  assert(example.includes('<h3>First &lt;script&gt;</h3>'));
  assert(example.includes('<h4>Body one</h4>'));
  assert(
    example.indexOf('First &lt;script&gt;') <
      example.indexOf('<h3>Second</h3>'),
  );
  assert(!example.includes('<h3>Read body</h3>'));
  const empty = fixture(
    {
      ...state,
      data: { ...state.data, concept: { ...concept, examples: [] } },
    },
    'concept',
    'one',
    'STUDENT',
    'example',
  ).html;
  assert(empty.includes('No examples are available for this Concept yet.'));
});

test('Revise renders escaped plain text, ordered optional sections and safe nested Markdown', () => {
  const concept: contracts.Concept = contracts.conceptSchema.parse({
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
    read: { summary: 'Read summary', bodyMarkdown: 'Read content' },
    source: {
      label: 'Source',
      url: 'https://example.invalid',
      sourceType: 'OFFICIAL_OR_TRUSTED',
      isOfficial: false,
    },
    revise: {
      summary: '<script>text</script> **plain**',
      keyPoints: ['Second <img>', 'First'],
      memoryTrick: '[plain](https://example.invalid)',
      importantCodeMarkdown: '## Code\n\n~~~js\nconst x = "<script>";\n~~~',
    },
  });
  const state = { ...ready, data: { ...ready.data!, concept } };
  const result = fixture(state, 'concept', 'one', 'STUDENT', 'revise');
  assert(result.html.includes('<h2>Revise</h2>'));
  assert(result.html.includes('&lt;script&gt;text&lt;/script&gt; **plain**'));
  assert(result.html.includes('[plain](https://example.invalid)'));
  assert(!result.html.includes('<script>'));
  assert(
    result.html.indexOf('Second &lt;img&gt;') <
      result.html.indexOf('<li>First</li>'),
  );
  assert(result.html.includes('<h3>Important code</h3>'));
  assert(result.html.includes('<h4>Code</h4>'));
  assert(!result.html.includes('Read content'));
  assert.equal((result.html.match(/<h1/g) ?? []).length, 1);
  for (const revise of [
    null,
    {
      summary: 'Summary',
      keyPoints: [],
      memoryTrick: null,
      importantCodeMarkdown: null,
    },
  ]) {
    const html = fixture(
      { ...state, data: { ...state.data, concept: { ...concept, revise } } },
      'concept',
      'one',
      'STUDENT',
      'revise',
    ).html;
    assert.equal(
      html.includes('No revision content is available for this Concept yet.'),
      revise === null,
    );
    for (const heading of ['Key points', 'Memory trick', 'Important code'])
      assert(!html.includes('<h3>' + heading));
  }
  const read = fixture(state, 'concept');
  read.buttons.find((button) => button.children === 'Revise')!.onClick();
  assert.deepEqual(read.selections, ['revise']);
  assert.deepEqual(read.calls, []);
  const names = ['Read', 'Example', 'Revise'];
  for (let index = 0; index < names.length; index++) {
    const wired = fixture(state, 'concept');
    const tab = wired.buttons.find(
      (button) => button.children === names[index],
    )!;
    let prevented = 0;
    for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End', 'Tab'])
      tab.onKeyDown!({ key, preventDefault: () => prevented++ });
    assert.deepEqual(wired.selections, [
      names[(index + 1) % 3]!.toLowerCase(),
      names[(index + 2) % 3]!.toLowerCase(),
      'read',
      'revise',
    ]);
    assert.equal(prevented, 4);
    assert.deepEqual(wired.calls, []);
  }
});
