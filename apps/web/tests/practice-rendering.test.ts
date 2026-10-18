import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as contracts from '../src/lib/practice/contracts';
import { difficultyLabels } from '../src/lib/concepts/contracts';
import { ConceptMarkdown } from '../src/components/concepts/concept-markdown';
import type { PracticeState } from '../src/lib/practice/practice-controller';
const id = 'a'.repeat(24);
const state: PracticeState = {
  type: 'OUTPUT',
  clearConfirmation: null,
  status: 'ready',
  page: 1,
  message: '',
  notice: '',
  drafts: { [id]: '<script>draft</script>' },
  focusRevision: 0,
  data: {
    success: true,
    message: null,
    data: [
      {
        id,
        conceptId: id,
        type: 'OUTPUT',
        difficulty: 'BEGINNER',
        prompt:
          '# Predict\n\n[Safe](https://example.invalid) [Unsafe](javascript:alert%281%29)\n\n![alt](https://image.invalid)\n\n<script>execute()</script>',
        starterCode: '  <script>inert()</script>\n ',
        language: 'JAVASCRIPT',
      },
    ],
    meta: { requestId: 'test', page: 1, limit: 10, total: 1, totalPages: 1 },
  },
};
function fixture(current = state, pending = false, role = 'STUDENT') {
  const require = createRequire(import.meta.url);
  const effects: (() => void)[] = [];
  const refs: { current: unknown }[] = [];
  const exports: {
    PracticeView?: (props: unknown) => ReactElement;
    PracticeBrowser?: (props: { conceptId: string }) => ReactElement | null;
  } = {};
  const source = readFileSync(
    new URL('../src/components/practice/practice-browser.tsx', import.meta.url),
    'utf8',
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const load = (name: string): unknown => {
    if (name === 'react')
      return {
        useEffect(effect: () => void) {
          effects.push(effect);
        },
        useRef: (value: unknown) => {
          const ref = { current: value };
          refs.push(ref);
          return ref;
        },
        useId: () => 'practice-test',
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
          state: {
            status: 'authenticated',
            pending,
            user: { id, role, status: 'ACTIVE', emailVerified: true },
          },
        }),
      };
    if (name === '../../hooks/use-practice') return {};
    if (name === '../../lib/practice/contracts') return contracts;
    if (name === '../../lib/concepts/contracts') return { difficultyLabels };
    if (name === '../concepts/concept-markdown') return { ConceptMarkdown };
    if (name.endsWith('.css')) return {};
    throw new Error('Unexpected import ' + name);
  };
  new Function('require', 'exports', output)(load, exports);
  const controller = {
    retry() {},
    load() {},
    setDraft() {},
    clearDrafts() {},
    selectType(type: string) {
      void type;
    },
  };
  const tree = exports.PracticeView!({
    conceptId: id,
    state: current,
    controller,
  });
  return {
    tree,
    effects,
    refs,
    controller,
    html: renderToStaticMarkup(tree),
    owner: exports.PracticeBrowser!({ conceptId: id }),
  };
}
test('practice safely renders restricted Markdown, inert code and escaped drafts with labelled controls', () => {
  const { html } = fixture();
  assert.match(html, /<h1[^>]*>Output practice/);
  assert.match(html, /<h2[^>]*>Question 1/);
  assert.match(html, /<h3>Predict/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<script|<img|href="javascript/);
  assert.match(html, /&lt;script&gt;inert/);
  assert.match(html, /&lt;script&gt;draft/);
  assert.match(html, /tabindex="0" role="region"/);
  assert.match(html, /<label for="practice-test-/);
  assert.match(html, /maxLength="10000"/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, /Nothing is submitted or saved/);
  assert.doesNotMatch(html, />Submit</);
  assert.match(html, /aria-label="Practice pagination"/);
});
test('loading, empty, out-of-range and error states are truthful and actionable', () => {
  assert.match(
    fixture({ ...state, status: 'loading', data: null }).html,
    /aria-busy="true"/,
  );
  assert.match(
    fixture({ ...state, status: 'error', data: null, message: 'Retry safely' })
      .html,
    /role="alert">Retry safely/,
  );
  assert.match(
    fixture({
      ...state,
      data: {
        ...state.data!,
        data: [],
        meta: { ...state.data!.meta, total: 0, totalPages: 0 },
      },
    }).html,
    /No published OUTPUT/,
  );
  assert.match(
    fixture({ ...state, page: 2, data: { ...state.data!, data: [] } }).html,
    /Back to first page/,
  );
});
test('pending authentication and non-Student accounts immediately hide protected content', () => {
  assert.equal(fixture(state, true).owner, null);
  assert.equal(fixture(state, false, 'ADMIN').owner, null);
  assert.equal(fixture().owner?.key, `${id}:${id}`);
});
test('responsive code containment and visible focus are declared without hiding page overflow', () => {
  const css = readFileSync(
    new URL(
      '../src/components/practice/practice-browser.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /overflow:\s*auto/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-height:\s*44px/);
  assert.doesNotMatch(css, /overflow[^;]*hidden/);
});

test('F032 native pressed controls and descriptive textarea preserve safe rendering', () => {
  const html = fixture({
    ...state,
    type: 'DESCRIPTIVE',
    data: {
      ...state.data!,
      data: state.data!.data.map((item) => ({ ...item, type: 'DESCRIPTIVE' })),
    },
  }).html;
  assert.match(html, /aria-label="Question type"/);
  assert.match(html, /aria-pressed="true">Descriptive/);
  assert.match(html, /Selected: Descriptive/);
  assert.match(html, /aria-label="Descriptive questions"/);
  assert.match(html, /Your descriptive answer for Question/);
  assert.match(html, /&lt;script&gt;draft/);
  assert.doesNotMatch(html, /<script|<img|>Submit<|>Unlock</);
  assert.doesNotMatch(html, /Confirm clear all drafts/);
  const confirmation = fixture({ ...state, clearConfirmation: 1 }).html;
  assert.match(confirmation, /aria-label="Confirm clearing drafts"/);
  assert.match(confirmation, /Confirm clear all drafts/);
  assert.match(confirmation, /Keep drafts/);
  assert.match(confirmation, /across Output, Descriptive, Scenario and Coding/);
});

test('F032-F034 selecting added types suppresses heading focus, including initial readiness', () => {
  for (const label of ['Descriptive', 'Scenario', 'Coding']) {
    const f = fixture();
    let headingFocus = 0,
      chosen = '';
    f.refs[0]!.current = { focus: () => headingFocus++ };
    f.controller.selectType = (type: string) => {
      chosen = type;
    };
    function find(node: unknown): { onClick: () => void } | undefined {
      if (Array.isArray(node)) {
        for (const child of node) {
          const result = find(child);
          if (result) return result;
        }
        return;
      }
      if (!node || typeof node !== 'object' || !('props' in node)) return;
      const props = (
        node as { props: { children?: unknown; onClick?: () => void } }
      ).props;
      if (props.children === label && props.onClick)
        return { onClick: props.onClick };
      return find(props.children);
    }
    const button = find(f.tree);
    assert(button);
    button.onClick();
    assert.equal(chosen, label.toUpperCase());
    f.effects.forEach((effect) => effect());
    assert.equal(headingFocus, 0);
    const initial = fixture();
    initial.refs[0]!.current = { focus: () => headingFocus++ };
    initial.effects.forEach((effect) => effect());
    assert.equal(headingFocus, 1);
  }
});

test('F034 Coding renders inert context separately from an initially empty code draft', () => {
  const current: PracticeState = {
    ...state,
    type: 'CODING',
    drafts: {},
    data: {
      ...state.data!,
      data: state.data!.data.map((item) => ({ ...item, type: 'CODING' })),
    },
  };
  const html = fixture(current).html;
  assert.match(html, /aria-pressed="true">Coding/);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /Coding practice/);
  assert.match(html, /aria-label="Coding questions"/);
  assert.match(html, /Your code draft for Question 1/);
  assert.match(html, /<textarea[^>]*><\/textarea>/);
  assert.match(html, /&lt;script&gt;inert/);
  assert.doesNotMatch(
    html,
    /<script|<img|href="javascript|>Run<|>Submit<|>Unlock<|>Score</,
  );
  const code = '\t  const value = "<script>draft</script>";\n\n  ';
  const authored = fixture({ ...current, drafts: { [id]: code } }).html;
  assert(
    authored.includes(
      '\t  const value = &quot;&lt;script&gt;draft&lt;/script&gt;&quot;;\n\n  </textarea>',
    ),
  );
  const optional = fixture({
    ...current,
    data: {
      ...current.data!,
      data: current.data!.data.map((item) => ({
        ...item,
        starterCode: null,
        language: null,
      })),
    },
  }).html;
  assert.doesNotMatch(
    optional,
    /Question 1 code|question code \(not executed\)/,
  );
  assert.match(optional, /<textarea[^>]*><\/textarea>/);
  const confirmation = fixture({ ...current, clearConfirmation: 1 }).html;
  assert.match(confirmation, /across Output, Descriptive, Scenario and Coding/);
  for (const status of ['loading', 'error'] as const) {
    const rendered = fixture({
      ...current,
      status,
      data: null,
      message: 'Safe failure',
    }).html;
    assert.match(
      rendered,
      status === 'loading'
        ? /Loading coding questions/
        : /role="alert">Safe failure/,
    );
  }
  assert.match(
    fixture({
      ...current,
      data: {
        ...current.data!,
        data: [],
        meta: { ...current.data!.meta, total: 0, totalPages: 0 },
      },
    }).html,
    /No published CODING/,
  );
});

test('F033 Scenario retains safe rendering alongside four native selectors', () => {
  const current: PracticeState = {
    ...state,
    type: 'SCENARIO',
    data: {
      ...state.data!,
      data: state.data!.data.map((item) => ({ ...item, type: 'SCENARIO' })),
    },
  };
  const html = fixture(current).html;
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 4);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.match(html, /aria-pressed="true">Scenario/);
  assert.match(html, /Selected: Scenario/);
  assert.match(html, /Scenario practice/);
  assert.match(html, /aria-label="Scenario questions"/);
  assert.match(html, /Your scenario answer for Question 1/);
  assert.match(html, /&lt;script&gt;inert/);
  assert.match(html, /&lt;script&gt;draft/);
  assert.doesNotMatch(
    html,
    /<script|<img|href="javascript|>Submit<|>Score<|>Unlock</,
  );
  assert.match(
    fixture({ ...current, status: 'loading', data: null }).html,
    /Loading scenario questions/,
  );
  assert.match(
    fixture({ ...current, status: 'error', data: null, message: 'Safe error' })
      .html,
    /role="alert">Safe error/,
  );
  assert.match(
    fixture({
      ...current,
      data: {
        ...current.data!,
        data: [],
        meta: { ...current.data!.meta, total: 0, totalPages: 0 },
      },
    }).html,
    /No published SCENARIO/,
  );
});
