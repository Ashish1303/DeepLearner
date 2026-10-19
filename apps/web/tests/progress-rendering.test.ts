import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { ProgressState } from '../src/lib/progress/progress-controller';
const id = 'a'.repeat(24);
function fixture(state: ProgressState) {
  const require = createRequire(import.meta.url),
    out: {
      ConceptProgressView?: (props: {
        state: ProgressState;
        retry: () => void;
      }) => ReactElement;
    } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/concepts/concept-progress.tsx',
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
  new Function('require', 'exports', compiled)((name: string) => {
    if (name === 'react/jsx-runtime') return require(name);
    if (name.endsWith('.css')) return {};
    if (
      name === '../../hooks/use-auth' ||
      name === '../../hooks/use-concept-progress'
    )
      return {};
    throw Error('Unexpected import ' + name);
  }, out);
  return renderToStaticMarkup(
    createElement(out.ConceptProgressView!, { state, retry: () => {} }),
  );
}
test('loading and unavailable activity have semantic announcements and native Retry without invented zero', () => {
  const loading = fixture({ status: 'loading', data: null });
  assert(loading.includes('aria-label="Saved practice activity"'));
  assert(loading.includes('aria-busy="true"'));
  assert(loading.includes('role="status"'));
  const error = fixture({ status: 'error', data: null });
  assert(error.includes('Activity is temporarily unavailable'));
  assert(error.includes('<button type="button">Retry activity</button>'));
  assert(!error.includes('No saved attempts'));
});
test('empty and saved states show activity counts and semantic UTC timestamps only', () => {
  const empty = fixture({
    status: 'ready',
    data: {
      conceptId: id,
      status: 'NOT_STARTED',
      attemptCount: 0,
      startedAt: null,
      lastActivityAt: null,
    },
  });
  assert(empty.includes('No saved attempts'));
  assert(!empty.includes('<time'));
  const at = '2026-10-19T00:00:00.000Z';
  const saved = fixture({
    status: 'ready',
    data: {
      conceptId: id,
      status: 'IN_PROGRESS',
      attemptCount: 3,
      startedAt: at,
      lastActivityAt: at,
    },
  });
  assert(saved.includes('3 saved practice attempts'));
  assert(saved.includes('dateTime="') || saved.includes('datetime="'));
  for (const text of [
    'XP',
    'Mark complete',
    'mastery',
    'score',
    '<progress',
    'studentAnswer',
    '<textarea',
  ])
    assert(!saved.includes(text));
  assert(saved.includes('does not mark this Concept complete'));
});
test('panel CSS preserves focus, containment and responsive wrapping without framework dependencies', () => {
  const css = readFileSync(
    new URL(
      '../src/components/concepts/concept-progress.module.css',
      import.meta.url,
    ),
    'utf8',
  );
  assert(css.includes(':focus-visible'));
  assert(css.includes('flex-wrap'));
  assert(css.includes('overflow-wrap'));
});
