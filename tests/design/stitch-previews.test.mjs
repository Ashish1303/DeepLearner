import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test } from 'node:test';

const root = new URL('../../docs/design/stitch/previews/', import.meta.url);
const pages = ['ai-studio.html', 'interview.html'];
for (const name of pages) {
  const html = readFileSync(new URL(name, root), 'utf8');
  test(
    name + ' is clearly design-only and has no executable or network content',
    () => {
      assert.match(html, /PREVIEW \/ NOT AVAILABLE/);
      assert.match(html, /Production readiness NOT_VERIFIED/);
      assert.doesNotMatch(
        html,
        /<script\b|<iframe\b|<form\b|<object\b|<embed\b|\son\w+\s*=|javascript:|contenteditable|https?:\/\//i,
      );
      assert.doesNotMatch(html, /\b(?:src|action)\s*=/i);
      const links = [...html.matchAll(/\bhref="([^"]+)"/g)].map(
        (match) => match[1],
      );
      assert(
        links.every((href) => href === 'preview.css' || href.startsWith('#')),
      );
      const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(
        (match) => match[1],
      );
      assert.equal(new Set(ids).size, ids.length);
      for (const href of links.filter((link) => link.startsWith('#')))
        assert(ids.includes(href.slice(1)));
    },
  );
  test(name + ' cannot submit unavailable business actions', () => {
    const controls = [
      ...html.matchAll(/<(?:button|input|select|textarea)\b([^>]*)>/gi),
    ];
    assert(controls.length > 0);
    for (const [, attributes] of controls)
      assert.match(attributes, /\bdisabled(?:\s|=|$)/);
    assert.equal((html.match(/<main\b/g) ?? []).length, 1);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /name="viewport"/);
  });
}
test('AI preview separates approval from publishing and never invents live evidence', () => {
  const html = readFileSync(new URL('ai-studio.html', root), 'utf8');
  for (const id of [
    'overview',
    'outline',
    'generation',
    'review',
    'comparison',
    'publishing',
  ])
    assert(html.includes('id="' + id + '"'));
  assert.match(html, /Approval does not publish/);
  assert.match(html, /No job is running/);
  assert.match(html, /Sources and quality checks/);
  assert.doesNotMatch(
    html,
    /\b\d+(?:\.\d+)?%|₹\s*\d|\b(?:Claude|Gemini|GPT)[ -]?\d/i,
  );
});
test('preview styles contain no remote assets, hidden scrollbars or forced motion', () => {
  const css = readFileSync(new URL('preview.css', root), 'utf8');
  assert.doesNotMatch(
    css,
    /@import|url\(|scrollbar-width:\s*none|::-webkit-scrollbar|animation:\s*(?!none)[a-z]/i,
  );
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
test('Interview preview distinguishes native disclosure from data, grading and execution', () => {
  const html = readFileSync(new URL('interview.html', root), 'utf8').replace(
    /\s+/g,
    ' ',
  );
  for (const type of ['Theory', 'Scenario', 'Output', 'Debugging', 'Coding'])
    assert.match(html, new RegExp('<span>\\s*' + type + '\\s*</span\\s*>'));
  assert.match(html, /<details data-preview-answer>/);
  assert.match(html, /No prepared answer is loaded/);
  assert.match(html, /No timed mock interview/);
  assert.match(html, /not a functioning editor/);
  assert.match(html, /Approval does not publish/);
  assert.match(html, /creates no Practice attempt/);
  assert.doesNotMatch(
    html,
    /\b\d+(?:\.\d+)?%|\b(?:accessToken|refreshToken|passwordHash)\b/,
  );
});
