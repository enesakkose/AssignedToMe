import type { Attachment, DescriptionPart } from '@mytask/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { InlineImage } from './attachment-images';

export const inlineImageIds = (parts: DescriptionPart[] | undefined) =>
  new Set(parts?.flatMap((p) => (p.type === 'image' ? [p.attachmentId] : [])));

type Props = {
  text: string | undefined;
  parts: DescriptionPart[] | undefined;
  attachments: Attachment[] | undefined;
  connectionId: string;
  onOpen: (url: string) => void;
  className: string;
  lines: 'line-clamp-4' | 'line-clamp-6';
  /** Always show it all (the detail page has room). */
  unfolded?: boolean;
};

/**
 * A description or comment, with links and images where the author put them. Long ones fold with "Show more"
 * instead of scrolling inside the card (a scroll inside a scroll traps the wheel).
 */
export function RichText({ text = '', parts, attachments, connectionId, onOpen, className, lines, unfolded }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // shortcut: guesses "long" from length, line breaks and images, not rendered height; fine at the popover's fixed width.
  const long = !unfolded && (text.length > 320 || text.split('\n').length > 6 || !!parts?.some((p) => p.type === 'image'));
  // Line clamping only works on plain text; with images a height cap does the folding.
  const fold = long && !open && (parts ? 'max-h-48 overflow-hidden' : lines);
  return (
    <div className="flex flex-col items-start gap-1">
      <div data-selectable className={cn('w-full break-words whitespace-pre-line text-ink-2 [overflow-wrap:anywhere]', className, fold)}>
        {parts
          ? parts.map((p, i) => {
              if (p.type === 'text') return <span key={i}>{p.text}</span>;
              if (p.type === 'link')
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onOpen(p.url)}
                    title={p.url}
                    className="text-ink underline underline-offset-2 hover:text-progress"
                  >
                    {p.text}
                  </button>
                );
              const attachment = attachments?.find((a) => a.id === p.attachmentId);
              return attachment ? <InlineImage key={i} connectionId={connectionId} attachment={attachment} onOpen={onOpen} /> : null;
            })
          : text}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-ink hover:underline">
          {open ? t('tasks.showLess') : t('tasks.showMore')}
        </button>
      )}
    </div>
  );
}
