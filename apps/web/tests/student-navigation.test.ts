import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
function render(file: string, symbol: string, path: string) {
  const require = createRequire(import.meta.url);
  const exports: Record<string, ComponentType> = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL('../src/components/student/' + file, import.meta.url),
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
  const load = (id: string): unknown => {
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'next/link')
      return {
        __esModule: true,
        default: (props: Record<string, unknown>) => createElement('a', props),
      };
    if (id === 'next/navigation') return { usePathname: () => path };
    if (id === '../../hooks/use-auth')
      return {
        useAuth: () => ({
          state: {
            user: { firstName: 'Test', lastName: 'Student', plan: 'FREE' },
            pending: false,
          },
          controller: { logout() {} },
        }),
      };
    if (id === '../ui/icon') return { Icon: () => null };
    if (id === './student-shell.module.css')
      return { active: 'active', navLink: 'link' };
    throw Error('Unexpected import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  const Component = exports[symbol];
  assert(Component);
  return renderToStaticMarkup(createElement(Component));
}
test('student navigation promotes Explore exactly once and marks only the actual current route', () => {
  for (const path of ['/dashboard', '/onboarding', '/explore-technologies']) {
    const html = render('student-navigation.tsx', 'StudentNavigation', path);
    assert.equal((html.match(/Explore Technologies/g) || []).length, 1);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert(html.includes('href="' + path + '" aria-current="page"'));
    assert(!html.match(/<li[^>]*>Explore Technologies/));
  }
});
test('student header titles preserve dashboard/onboarding and label Explore', () => {
  for (const [path, title] of [
    ['/dashboard', 'Dashboard'],
    ['/onboarding', 'Student onboarding'],
    ['/explore-technologies', 'Explore technologies'],
  ] as const) {
    const html = render('student-header.tsx', 'StudentHeader', path);
    assert(html.includes(title));
    assert(html.includes('aria-haspopup="dialog"'));
  }
});
