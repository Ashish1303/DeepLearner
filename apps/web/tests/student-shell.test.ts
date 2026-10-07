import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Render the actual shell offline. Stub only its imported children/auth context
// and CSS module; no DOM/browser behavior is claimed by this structural test.
function renderShell(message: string) {
  const source = readFileSync(
    new URL('../src/components/student/student-shell.tsx', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const require = createRequire(import.meta.url);
  const exports: { StudentShell?: ComponentType<{ children?: ReactNode }> } =
    {};
  const load = (id: string) => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id);
    if (id === '../../hooks/use-auth')
      return { useAuth: () => ({ state: { message, pending: false } }) };
    if (id === './student-shell.module.css') return { error: 'feedback' };
    if (id === './student-navigation') return { StudentNavigation: () => null };
    if (id === './student-header') return { StudentHeader: () => null };
    if (id === '../ui/icon') return { Icon: () => null };
    throw new Error('Unexpected shell import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  assert(exports.StudentShell);
  return renderToStaticMarkup(
    createElement(exports.StudentShell, null, 'Account content'),
  );
}

test('logout failure alert is inside the mobile dialog, with desktop feedback retained', () => {
  const message = 'Sign-out was not confirmed. Please try again.';
  const html = renderShell(message);
  const dialog = html.match(/<dialog\b[^>]*>([\s\S]*?)<\/dialog>/)?.[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
  assert(dialog);
  assert(main);
  for (const region of [dialog, main]) {
    assert.match(region, /<p\b[^>]*role="alert"[^>]*>/);
    assert(region.includes(message));
  }
});

test('shell does not render empty logout failure alerts', () => {
  assert(!renderShell('').includes('role="alert"'));
});
