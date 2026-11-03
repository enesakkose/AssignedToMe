import { isSafeUrl, type Attachment } from '@mytask/core';
import DOMPurify from 'dompurify';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useLoadAttachment } from '../hooks/use-attachment';
import { ImagePreview } from './attachment-images';

// Rendered HTML from the source is untrusted: no scripts, forms, frames, inline styles or ids; only plain markup survives.
// Our own instance, so these hooks can't stack up on the shared one (or affect anyone else's use of it).
const purify = DOMPurify(window);
purify.addHook('afterSanitizeAttributes', (node) => {
  // Images load through the connection (credentials only to its own site), never straight from the HTML.
  if (node.tagName === 'IMG' && node.hasAttribute('src')) {
    node.setAttribute('data-src', node.getAttribute('src') ?? '');
    node.removeAttribute('src');
  }
  // Links never navigate the app's own window (no href left to follow); a click or Enter opens them outside.
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('data-href', node.getAttribute('href') ?? '');
    node.removeAttribute('href');
    node.setAttribute('role', 'link');
    node.setAttribute('tabindex', '0');
  }
});

export const sanitizeSourceHtml = (html: string) =>
  purify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'iframe', 'object', 'embed', 'video', 'audio', 'source', 'link', 'meta', 'base'],
    FORBID_ATTR: ['style', 'srcset', 'id', 'name', 'target', 'onclick'],
  });

type Props = {
  html: string;
  /** The source site (links and images in the HTML are relative to it). */
  base: string;
  connectionId: string;
  onOpen: (url: string) => void;
  className?: string;
};

/** HTML the source rendered (tables, panels, smart links…), sanitized; links open outside, images load with the connection. */
export function SourceHtml({ html, base, connectionId, onOpen, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const safe = useMemo(() => sanitizeSourceHtml(html), [html]);
  const load = useLoadAttachment(connectionId);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const resolve = (url: string) => {
    try {
      return new URL(url, `${base}/`).toString();
    } catch {
      return undefined;
    }
  };

  const openLink = (link: HTMLElement) => {
    const url = resolve(link.dataset.href ?? '');
    if (url && isSafeUrl(url)) onOpen(url);
  };

  // Fill each image once it's downloaded; a failed one is simply left out.
  useEffect(() => {
    const images = ref.current?.querySelectorAll<HTMLImageElement>('img[data-src]') ?? [];
    for (const img of images) {
      const url = resolve(img.dataset.src ?? '');
      if (!url || !load) {
        img.remove();
        continue;
      }
      load(url).then(
        (data) => {
          img.src = data;
        },
        () => img.remove(),
      );
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs per rendered HTML
  }, [safe]);

  return (
    <>
      <div
        ref={ref}
        data-selectable
        className={cn('source-html', className)}
        onKeyDown={(e) => {
          const link = (e.target as HTMLElement).closest<HTMLElement>('a[data-href]');
          if (link && e.key === 'Enter') openLink(link);
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const link = target.closest<HTMLElement>('a[data-href]');
          if (link) {
            e.preventDefault();
            openLink(link);
            return;
          }
          if (target instanceof HTMLImageElement && target.src) {
            const url = resolve(target.dataset.src ?? '');
            if (url) setPreview({ id: url, name: target.alt || url.split('/').pop() || '', url });
          }
        }}
        // eslint-disable-next-line react/no-danger -- sanitized with DOMPurify above
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      {preview && <ImagePreview connectionId={connectionId} attachment={preview} onClose={() => setPreview(null)} onOpen={onOpen} />}
    </>
  );
}
