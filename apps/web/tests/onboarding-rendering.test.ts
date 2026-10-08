import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as profileTools from '../src/lib/onboarding/profile';
import type { CurrentUser } from '../src/lib/api/contracts';
import type { ProfileResult } from '../src/lib/auth/auth-controller';

const preferences = {
  experienceLevel: 'BEGINNER' as const,
  learningGoals: ['QUICK_REVISION' as const],
  preferredDifficulty: 'INTERMEDIATE' as const,
  dailyStudyGoalMinutes: 30,
  interestedTechnologyIds: [],
};
// Execute the actual component with a small in-memory hook adapter. Browser
// focus/layout, React effect scheduling and real requests are NOT verified here.
function fixture(profile: CurrentUser['profile'] = null) {
  const require = createRequire(import.meta.url);
  const values: unknown[] = [];
  let cursor = 0;
  let result: ProfileResult = {
    kind: 'error',
    message: 'Service unavailable. Try again.',
  };
  const saves: unknown[] = [];
  const auth = {
    state: { user: { profile }, pending: false },
    controller: {
      async saveProfile(input: unknown) {
        saves.push(input);
        return result;
      },
      async checkProfile() {
        return result;
      },
    },
  };
  const exports: { OnboardingWizard?: () => ReactElement } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/onboarding/onboarding-wizard.tsx',
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
  const load = (id: string) => {
    if (id === 'react')
      return {
        useState(initial: unknown) {
          const index = cursor++;
          if (!(index in values))
            values[index] = typeof initial === 'function' ? initial() : initial;
          return [
            values[index],
            (next: unknown) => {
              values[index] =
                typeof next === 'function' ? next(values[index]) : next;
            },
          ];
        },
        useRef: () => ({ current: null }),
        useEffect() {},
      };
    if (id === 'react/jsx-runtime') return require(id);
    if (id === '../../hooks/use-auth') return { useAuth: () => auth };
    if (id === '../../lib/onboarding/profile') return profileTools;
    if (id === './onboarding.module.css') return {};
    throw new Error('Unexpected wizard import');
  };
  new Function('require', 'exports', compiled)(load, exports);
  assert(exports.OnboardingWizard);
  const render = () => {
    cursor = 0;
    return exports.OnboardingWizard!();
  };
  function nodes(node: ReactNode): ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (!isValidElement<Record<string, unknown>>(node)) return [];
    return [node, ...nodes(node.props.children as ReactNode)];
  }
  const find = (
    match: (node: ReactElement<Record<string, unknown>>) => boolean,
  ) => {
    const node = nodes(render()).find(match);
    assert(node, 'Expected wizard control');
    return node;
  };
  return {
    html: () => renderToStaticMarkup(render()),
    saves,
    setResult(next: ProfileResult) {
      result = next;
    },
    change(name: string, value: string, checked = true) {
      const node = find(
        (n) =>
          n.type === 'input' &&
          n.props.name === name &&
          (n.props.type === 'number' || n.props.value === value),
      );
      (node.props.onChange as (event: unknown) => void)({
        target: { value, checked },
      });
    },
    async submit() {
      await (
        find((n) => n.type === 'form').props.onSubmit as (
          event: unknown,
        ) => Promise<void>
      )({ preventDefault() {} });
    },
    async click(text: string) {
      await (
        find((n) => n.type === 'button' && n.props.children === text).props
          .onClick as () => Promise<void> | void
      )();
    },
  };
}

test('wizard uses real prefill, semantic controls and truthful reload/catalog notices', () => {
  const empty = fixture().html();
  assert.match(empty, /Step 1 of 4/);
  assert.match(empty, /<fieldset/);
  assert.match(empty, /<legend>Experience level/);
  assert.match(empty, /type="radio"/);
  assert.match(empty, /discards unsaved changes/);
  assert.match(empty, /Technology selection will be available/);
  assert(!empty.includes('Skip'));
  const review = fixture(preferences).html();
  assert.match(review, /Step 4 of 4/);
  assert.match(review, /Quick revision/);
  assert.match(review, /30 minutes/);
});

test('Back/Next retain draft, validate fields and final submission contains only approved fields', async () => {
  const f = fixture();
  await f.submit();
  assert.match(f.html(), /Choose your experience level/);
  f.change('experienceLevel', 'ADVANCED');
  await f.submit();
  assert.match(f.html(), /Step 2 of 4/);
  f.change('learningGoals', 'QUICK_REVISION');
  await f.submit();
  f.change('preferredDifficulty', 'INTERMEDIATE');
  f.change('dailyStudyGoalMinutes', '45');
  await f.click('Back');
  await f.submit();
  assert.match(f.html(), /value="45"/);
  await f.submit();
  await f.submit();
  assert.deepEqual(f.saves, [
    {
      experienceLevel: 'ADVANCED',
      learningGoals: ['QUICK_REVISION'],
      preferredDifficulty: 'INTERMEDIATE',
      dailyStudyGoalMinutes: 45,
    },
  ]);
  assert.match(f.html(), /Service unavailable/);
  assert.match(f.html(), /45 minutes/);
});

test('ambiguous save keeps draft, gates resubmission and offers read-only reconciliation', async () => {
  const f = fixture(preferences);
  f.setResult({ kind: 'uncertain', message: 'Saving could not be confirmed.' });
  await f.submit();
  assert.match(f.html(), /Check saved profile and session/);
  assert.match(f.html(), /30 minutes/);
  await f.submit();
  assert.equal(f.saves.length, 1);
  f.setResult({ kind: 'success', user: { profile: null } as CurrentUser });
  await f.click('Check saved profile and session');
  assert.match(f.html(), /Your draft is unchanged/);
  assert.equal(f.saves.length, 1);
  f.setResult({ kind: 'error', message: 'Try again.' });
  await f.submit();
  assert.equal(f.saves.length, 2);
});
