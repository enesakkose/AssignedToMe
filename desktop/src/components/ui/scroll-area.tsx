import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Native-feeling thin scrollbar that shows while scrolling or hovered. */
export function ScrollArea({ className, children, ...props }: ComponentProps<typeof BaseScrollArea.Root>) {
  return (
    <BaseScrollArea.Root className={cn('relative min-h-0 overflow-hidden', className)} {...props}>
      <BaseScrollArea.Viewport className="h-full overscroll-contain outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar
        className={cn(
          'flex w-2 justify-center p-0.5 opacity-0 transition-opacity duration-[var(--dur-short)]',
          'data-[hovering]:opacity-100 data-[scrolling]:opacity-100',
        )}
      >
        <BaseScrollArea.Thumb className="w-full rounded-full bg-muted/40" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  );
}
