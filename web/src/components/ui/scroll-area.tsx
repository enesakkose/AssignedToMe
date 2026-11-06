"use client";

import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * A scroller whose bar takes no room: a thin thumb laid over the content, shown while scrolling or hovered, as on
 * desktop. `viewportClassName` styles the scrolling box itself (sticky headers stick to it).
 */
export function ScrollArea({
  className,
  viewportClassName,
  children,
  ...props
}: ComponentProps<typeof BaseScrollArea.Root> & { viewportClassName?: string }) {
  return (
    <BaseScrollArea.Root className={cn("relative min-h-0 overflow-hidden", className)} {...props}>
      <BaseScrollArea.Viewport
        className={cn(
          "h-full overscroll-contain outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
          viewportClassName,
        )}
      >
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className="z-30 flex w-2.5 justify-center p-0.5 opacity-0 transition-opacity duration-[var(--dur-short)] data-[hovering]:opacity-100 data-[scrolling]:opacity-100">
        <BaseScrollArea.Thumb className="w-full rounded-full bg-muted/40" />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  );
}
