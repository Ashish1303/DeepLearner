import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConceptMarkdown } from '../src/components/concepts/concept-markdown';
import { safeHttpsUrl } from '../src/lib/concepts/contracts';
const render = (body: string) =>
  renderToStaticMarkup(createElement(ConceptMarkdown, { body }));

test('Revise important code uses h4 beneath its section and preserves safe non-executable code', () => {
  const html = renderToStaticMarkup(
    createElement(ConceptMarkdown, {
      headingBase: 4,
      body: '## Reference\n\n#### Nested\n\n~~~js\n  const text = "<script>";\n~~~\n\n<script>alert(1)</script>\n\n![alt](https://bad.invalid/a)\n\n[unsafe](https://user:pass@bad.invalid)\n\n[safe](https://example.invalid/docs)',
    }),
  );
  assert(html.includes('<h4>Reference</h4>'));
  assert(html.includes('<h5>Nested</h5>'));
  assert(!/<(?:h1|h2|h3|script|img|iframe)\b/.test(html));
  assert(html.includes('  const text = &quot;&lt;script&gt;&quot;;'));
  assert(html.includes('tabindex="0"'));
  assert(html.includes('rel="noopener noreferrer"'));
  assert(!html.includes('href="https://user'));
});
test('Markdown renders supported structure below page h1 and Read h2', () => {
  const html = render(
    '# Definition\n\n## Detail\n\n- First\n- **Second**\n\n> Note\n\n```js\nconst a = "<script>";\n```',
  );
  assert(html.includes('<h3>Definition</h3>'));
  assert(html.includes('<h4>Detail</h4>'));
  assert(!html.includes('<h1'));
  assert(html.includes('<ul>'));
  assert(html.includes('<strong>Second</strong>'));
  assert(html.includes('<blockquote>'));
  assert(html.includes('tabindex="0"'));
  assert(html.includes('aria-label="Code block"'));
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('class="language-'));
});
test('every starting Markdown heading level nests directly below Read h2', () => {
  for (let level = 1; level <= 6; level++) {
    const html = render(`${'#'.repeat(level)} First`);
    assert.equal(html, '<h3>First</h3>', `starting level ${level}`);
  }
});
test('nested headings compress skipped levels and preserve sibling/ancestor relationships', () => {
  const html = render(
    '## Root\n\n#### Child\n\n##### Grandchild\n\n### Sibling\n\n## Root again\n\n# New root\n\n###### Child again',
  );
  assert.deepEqual(
    [...html.matchAll(/<h([1-6])>(.*?)<\/h[1-6]>/g)].map((match) => [
      Number(match[1]),
      match[2],
    ]),
    [
      [3, 'Root'],
      [4, 'Child'],
      [5, 'Grandchild'],
      [4, 'Sibling'],
      [3, 'Root again'],
      [3, 'New root'],
      [4, 'Child again'],
    ],
  );
  assert(!/<h[12][ >]/.test(html));
});
test('parsed setext headings normalize, fenced headings do not affect levels, and depth caps at h6', () => {
  const html = render(
    '```md\n# Not a heading\n```\n\nFirst\n-----\n\n### Child',
  );
  assert.deepEqual(
    [...html.matchAll(/<h([1-6])>/g)].map((m) => m[1]),
    ['3', '4'],
  );
  const deep = render('# A\n\n## B\n\n### C\n\n#### D\n\n##### E\n\n###### F');
  assert.deepEqual(
    [...deep.matchAll(/<h([1-6])>/g)].map((m) => m[1]),
    ['3', '4', '5', '6', '6', '6'],
  );
  assert.equal(
    render('###### Independent document'),
    '<h3>Independent document</h3>',
  );
});
test('raw HTML, scripts, event handlers, iframes and remote images never become executable markup', () => {
  const html = render(
    '<script>alert(1)</script>\n\n<img src="https://evil.invalid/a" onerror="alert(1)">\n\n<iframe src="https://evil.invalid"></iframe>\n\n![Safe alt](https://evil.invalid/image.png)',
  );
  for (const value of [
    '<script',
    '<img',
    '<iframe',
    'onerror',
    'src=',
    'evil.invalid',
  ])
    assert(!html.includes(value));
  assert(html.includes('Safe alt'));
});
test('invalid links remain text while HTTPS links are isolated and announced', () => {
  for (const url of [
    'javascript:alert%281%29',
    'data:text/html,test',
    '//evil.invalid',
    '/relative',
    'http://example.invalid',
    'https://user:pass@example.invalid',
    'https:\\evil.invalid',
  ]) {
    assert.equal(safeHttpsUrl(url), undefined);
    assert(!render(`[Label](${url})`).includes('<a '));
  }
  const html = render('[Source](https://example.invalid/docs)');
  assert(html.includes('href="https://example.invalid/docs"'));
  assert(html.includes('rel="noopener noreferrer"'));
  assert(html.includes('target="_blank"'));
  assert(html.includes('opens in a new tab'));
});
test('entity-obfuscated schemes, blank images and maximum-size body remain safe text', () => {
  assert(!render('[unsafe](jav&#x61;script:alert%281%29)').includes('<a '));
  assert(!render('![](data:image/svg+xml,test)').includes('<img'));
  assert(render('![](https://example.invalid/a)').includes('Image omitted'));
  assert.equal(render('x'.repeat(50000)), '<p>' + 'x'.repeat(50000) + '</p>');
});

test('Example heading base nests below h3 titles, compresses jumps and caps at h6', () => {
  for (let depth = 1; depth <= 6; depth++)
    assert.equal(
      renderToStaticMarkup(
        createElement(ConceptMarkdown, {
          body: '#'.repeat(depth) + ' First',
          headingBase: 4,
        }),
      ),
      '<h4>First</h4>',
    );
  const html = renderToStaticMarkup(
    createElement(ConceptMarkdown, {
      body: '## First\n\n#### Child\n\n##### Deep\n\n###### Deeper\n\n## Sibling',
      headingBase: 4,
    }),
  );
  assert.deepEqual(
    [...html.matchAll(/<h([1-6])>/g)].map((m) => m[1]),
    ['4', '5', '6', '6', '4'],
  );
  const hostile = renderToStaticMarkup(
    createElement(ConceptMarkdown, {
      body: '<script>alert(1)</script>\n\n![alt](https://bad.invalid/img)\n\n[bad](javascript:alert%281%29)\n\n[good](https://example.invalid/docs)\n\n~~~js\n<script>text</script>\n~~~',
      headingBase: 4,
    }),
  );
  assert(!/<(?:script|img|iframe)\b/.test(hostile));
  assert(!hostile.includes('href="javascript:'));
  assert(hostile.includes('rel="noopener noreferrer"'));
  assert(hostile.includes('&lt;script&gt;'));
});
