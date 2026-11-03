import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Multi-line text, same surface and focus ring as `Input` but with card radius. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={3}
      spellCheck={false}
      className={cn(
        'min-h-16 w-full min-w-0 resize-y rounded-input border border-rule-2 bg-paper px-3 py-2 text-md text-ink',
        'placeholder:text-muted/70 transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-out hover:border-muted/60',
        'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_18%,transparent)] focus-visible:outline-none',
        'aria-[invalid=true]:border-error',
        className,
      )}
      {...props}
    />
  );
}
