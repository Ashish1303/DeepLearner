import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { CatalogState } from '../src/lib/technologies/catalog-controller';
const initial: CatalogState = {
  status: 'ready',
  page: 1,
  totalPages: 1,
  items: [],
  message: '',
  invalidRequest: false,
  focusRevision: 0,
};
function fixture(state: CatalogState, owner = 'owner-a') {
  const require = createRequire(import.meta.url);
  const exports: {
    CatalogContents?: ComponentType;
    TechnologyCatalog?: () => ReactElement;
  } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/technologies/technology-catalog.tsx',
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
  const calls: unknown[] = [];
  const load = (id: string): unknown => {
    if (id === 'react')
      return { useRef: () => ({ current: null }), useEffect() {} };
    if (id === 'react/jsx-runtime') return require(id);
    if (id === '../../hooks/use-auth')
      return {
        useAuth: () => ({
          state: {
            status: 'authenticated',
            user: { id: owner, role: 'STUDENT' },
          },
        }),
      };
    if (id === '../../hooks/use-technologies')
      return {
        useTechnologies: () => ({
          state,
          controller: {
            load: (...args: unknown[]) => calls.push(args),
            retry: () => calls.push('retry'),
          },
        }),
      };
    if (id === '../ui/icon') return { Icon: () => null };
    if (id === './technology-catalog.module.css') return {};
    throw Error('Unexpected import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  assert(exports.CatalogContents);
  assert(exports.TechnologyCatalog);
  return {
    html: renderToStaticMarkup(createElement(exports.CatalogContents)),
    ownerKey: exports.TechnologyCatalog().key,
  };
}
test('catalog renders informational semantic cards with generic fallback and no internal data/actions', () => {
  const { html } = fixture({
    ...initial,
    items: [
      {
        id: 'a'.repeat(24),
        name: 'Future <technology>',
        slug: 'future',
        description: null,
        iconAssetId: 'b'.repeat(24),
        order: 0,
      },
    ],
  });
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert(html.includes('<ul'));
  assert(html.includes('<article'));
  assert(html.includes('Future &lt;technology&gt;'));
  assert(html.includes('Description not available yet.'));
  assert(!html.includes('<a '));
  assert(!html.includes('<img'));
  assert(!html.includes('b'.repeat(24)));
  assert(!html.includes('Start learning'));
});
test('catalog renders loading, empty, safe error, rate guidance and later-page recovery controls', () => {
  assert(
    fixture({
      ...initial,
      status: 'loading',
      page: 2,
      totalPages: 3,
    }).html.includes('aria-busy="true"'),
  );
  assert.equal(
    (
      fixture({
        ...initial,
        status: 'loading',
        page: 2,
        totalPages: 3,
      }).html.match(/disabled=""/g) || []
    ).length,
    2,
  );
  assert(
    fixture({ ...initial, totalPages: 0 }).html.includes(
      'No technologies are available yet.',
    ),
  );
  assert(
    fixture({ ...initial, page: 3, totalPages: 2 }).html.includes(
      'Return to page 1',
    ),
  );
  const error = fixture({
    ...initial,
    status: 'error',
    invalidRequest: true,
    message: 'Please wait before trying again.',
  }).html;
  assert(error.includes('role="alert"'));
  assert(error.includes('Retry'));
  assert(error.includes('Return to page 1'));
  assert(error.includes('Please wait before trying again.'));
});
test('catalog account ownership changes component key without sharing request state', () => {
  assert.equal(fixture(initial, 'owner-a').ownerKey, 'owner-a');
  assert.equal(fixture(initial, 'owner-b').ownerKey, 'owner-b');
});

test('empty out-of-range pages announce no results and retain explicit page-one recovery', () => {
  for (const [page, totalPages] of [
    [2, 1],
    [3, 2],
    [2, 0],
  ]) {
    const { html } = fixture({
      ...initial,
      page: page!,
      totalPages: totalPages!,
    });
    assert.match(
      html,
      /<p role="status" aria-live="polite">The requested page has no results\.<\/p>/,
    );
    assert(!html.includes(`Page ${page} of ${totalPages}`));
    assert(html.includes('No technologies are available on this page.'));
    assert.match(html, /<button type="button">Return to page 1<\/button>/);
  }
});
