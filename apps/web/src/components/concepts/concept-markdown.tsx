import { createElement, type ReactNode } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import { safeHttpsUrl } from '../../lib/concepts/contracts';

// Render untrusted Markdown as restricted React elements, never HTML strings.
export function ConceptMarkdown({
  body,
  headingBase = 3,
}: {
  body: string;
  headingBase?: 3 | 4;
}) {
  // Collect levels from parsed headings, not Markdown-looking text in code blocks.
  // The synchronous Markdown API completes traversal before React renders the
  // returned elements; no bookkeeping escapes into a later render. All state is local
  // to this document, including sibling/deeper headings and skipped source levels.
  const ancestors: number[] = [];
  const levels = new WeakMap<object, number>();
  const heading = ({ node, children }: ExtraProps & { children?: ReactNode }) =>
    createElement(
      `h${node ? (levels.get(node) ?? headingBase) : headingBase}`,
      null,
      children,
    );
  return Markdown({
    skipHtml: true,
    allowedElements: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'ul',
      'ol',
      'li',
      'em',
      'strong',
      'blockquote',
      'br',
      'hr',
      'code',
      'pre',
      'a',
      'img',
    ],
    allowElement: (node) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const depth = Number(node.tagName.slice(1));
        while (ancestors.length && ancestors[ancestors.length - 1]! >= depth)
          ancestors.pop();
        ancestors.push(depth);
        levels.set(node, Math.min(ancestors.length + headingBase - 1, 6));
      }
      return true;
    },
    urlTransform: (value) => safeHttpsUrl(value),
    components: {
      // Read starts at h3; Example Markdown nests below its h3 title.
      h1: heading,
      h2: heading,
      h3: heading,
      h4: heading,
      h5: heading,
      h6: heading,
      a: ({ href, children }) => {
        const safe = href ? safeHttpsUrl(href) : undefined;
        return safe ? (
          <a href={safe} target="_blank" rel="noopener noreferrer">
            {children}
            <span> (opens in a new tab)</span>
          </a>
        ) : (
          <span>{children}</span>
        );
      },
      // img is admitted only so its alt text survives; no img DOM node is created.
      img: ({ alt }) => <span>{alt || 'Image omitted'}</span>,
      pre: ({ children }) => (
        <pre tabIndex={0} role="region" aria-label="Code block">
          {children}
        </pre>
      ),
      code: ({ children }) => <code>{children}</code>,
    },
    children: body,
  });
}
