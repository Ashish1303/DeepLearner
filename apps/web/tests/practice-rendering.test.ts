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
        useEffect() {},
        useRef: (value: unknown) => ({ current: value }),
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
  const controller = { retry() {}, load() {}, setDraft() {}, clearDrafts() {} };
  return {
    html: renderToStaticMarkup(
      exports.PracticeView!({ conceptId: id, state: current, controller }),
    ),
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
