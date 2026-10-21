import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { CompletionState } from '../src/lib/progress/completion-controller';
const cid = 'a'.repeat(24);
const sections = ['READ', 'VISUALIZE', 'EXAMPLE', 'PRACTICE'] as const;
function state(eligible = false): CompletionState {
  return {
    status: 'ready',
    message: '',
    challenge: null,
    data: {
      conceptId: cid,
      viewRevision: 'b'.repeat(64),
      requiredSections: [...sections],
      sections: sections.map((section) => ({
        section,
        status: eligible ? 'QUALIFIED' : 'MISSING',
      })),
      practice: {
        questionId: cid,
        type: 'OUTPUT',
        status: eligible ? 'QUALIFIED' : 'MISSING',
        score: eligible ? 100 : null,
        minimumScore: 70,
      },
      eligibility: eligible ? 'ELIGIBLE' : 'INELIGIBLE',
      blockers: eligible ? [] : [{ code: 'EVIDENCE_MISSING', section: 'READ' }],
      completion: { status: 'NOT_COMPLETED', completedAt: null },
      visualization: null,
    },
  };
}
function render(state: CompletionState) {
  const require = createRequire(import.meta.url),
    output: {
      ConceptCompletionView?: (p: Record<string, unknown>) => ReactElement;
    } = {};
  const compiled = ts.transpileModule(
    readFileSync(
      new URL(
        '../src/components/concepts/concept-completion.tsx',
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
    if (name === 'react' || name === 'react/jsx-runtime') return require(name);
    if (name === 'next/link')
      return {
        __esModule: true,
        default: (props: Record<string, unknown>) => createElement('a', props),
      };
    if (name.endsWith('.css') || name.startsWith('../../')) return {};
    if (name.includes('visualization-player'))
      return { VisualizationPlayer: () => null };
    throw Error('Unexpected import ' + name);
  }, output);
  const noop = () => Promise.resolve();
  return renderToStaticMarkup(
    createElement(output.ConceptCompletionView!, {
      state,
      account: '1'.repeat(24),
      concept: cid,
      controller: {
        refresh: noop,
        retry: noop,
        issue: noop,
        respond: noop,
        complete: noop,
      },
    }),
  );
}
test('loading, denied and ordinary Concept unavailable states never invent missing evidence or zero scores', () => {
  for (const status of ['loading', 'denied', 'unavailable'] as const) {
    const html = render({ status, data: null, challenge: null, message: '' });
    assert(html.includes('aria-label="Concept completion"'));
    assert(html.includes('role="status"'));
    assert(!html.includes('Original qualifying score'));
    assert(!html.includes('Complete Concept</button>'));
  }
});
test('incomplete and eligible states preserve required sections, threshold and explicit action', () => {
  const incomplete = render(state());
  assert(incomplete.includes('Read: Missing'));
  assert(incomplete.includes('Practice threshold: 70%'));
  assert(incomplete.includes('Revise is optional'));
  assert(incomplete.includes('reveal-assisted'));
  assert(incomplete.includes('disabled="">Complete Concept'));
  const eligible = render(state(true));
  assert(eligible.includes('Eligible to complete'));
  assert(!eligible.includes('disabled="">Complete Concept'));
});
test('saving, uncertain and confirmed completed states do not misrepresent aborted writes', () => {
  const saving = render({ ...state(true), status: 'saving' });
  assert(saving.includes('Saving. Please wait'));
  assert(saving.includes('aria-busy="true"'));
  const uncertain = render({
    ...state(true),
    status: 'uncertain',
    message: 'Unconfirmed request.',
  });
  assert(uncertain.includes('Retry unchanged request'));
  assert(!uncertain.includes('Concept completed. Saved'));
  const completed = state(true);
  completed.data!.completion = {
    status: 'COMPLETED',
    completedAt: '2026-10-20T10:00:00.000Z',
  };
  assert(render(completed).includes('Concept completed. Saved at'));
});
test('checkpoint uses native labelled radio controls, equivalent text and no animation requirement', () => {
  const s = state();
  s.challenge = {
    section: 'VISUALIZE',
    challenge: {
      id: cid,
      conceptId: cid,
      visualizationId: cid,
      checkpointId: 'check',
      checkpointVersion: 1,
      policyId: 'policy',
      policyVersion: 1,
      prompt: 'Which node?',
      textAlternative: 'Equivalent description.',
      choices: [
        { id: 'a', label: '<script>inert</script>' },
        { id: 'b', label: 'Other' },
      ],
      expiresAt: '2026-10-20T10:00:00.000Z',
    },
  };
  const html = render(s);
  assert(html.includes('<fieldset'));
  assert(html.includes('<legend>Which node?'));
  assert(html.includes('type="radio"'));
  assert(html.includes('Equivalent description.'));
  assert(html.includes('Playback and timing are not required'));
  assert(!html.includes('<script>inert'));
});
test('stale completion and conditional Revise remain visible requirements', () => {
  const s = state();
  s.data!.requiredSections.push('REVISE');
  s.data!.sections.push({ section: 'REVISE', status: 'MISSING' });
  s.data!.completion.status = 'STALE';
  const html = render(s);
  assert(html.includes('Revise: Missing'));
  assert(!html.includes('Revise is optional'));
  assert(html.includes('Previous completion is no longer current'));
});
