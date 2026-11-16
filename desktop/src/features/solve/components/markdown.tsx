import { isSafeUrl } from '@mytask/core';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { openExternal } from '@/lib/open-external';

// The agent's output is markdown, and may echo untrusted task text, so render md → HTML → sanitize.
// Our own instance (like source-html) so the link hook can't affect anyone else's DOMPurify use.
const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  // Links never navigate the popover itself; a click opens them outside (href stripped, data-href kept).
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('data-href', node.getAttribute('href') ?? '');
    node.removeAttribute('href');
  }
});

function render(text: string): string {
  const html = marked.parse(text, { async: false, breaks: true });
  return purify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Chat has no image loader; drop images and anything interactive or styled.
    FORBID_TAGS: ['img', 'style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'video', 'audio', 'source', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcset', 'id', 'name', 'target', 'onclick'],
  });
}

/** Renders an assistant message as markdown (headings, lists, code, links), styled by `.source-html`. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const safe = useMemo(() => render(text), [text]);
  return (
    <div
      className={cn('source-html', className)}
      onClick={(e) => {
        const link = (e.target as HTMLElement).closest<HTMLElement>('a[data-href]');
        const href = link?.dataset.href;
        if (href && isSafeUrl(href)) {
          e.preventDefault();
          void openExternal(href);
        }
      }}
      // eslint-disable-next-line react/no-danger -- sanitized with DOMPurify above
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
