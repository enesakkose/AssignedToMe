"use client";

import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

export const TooltipProvider = BaseTooltip.Provider;

/** Wraps one focusable element. After the first one opens, neighbours open at once (the provider's shared delay). */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="z-50">
          <BaseTooltip.Popup className="max-w-60 rounded-sm bg-graphite px-2 py-1 text-sm text-graphite-ink shadow-float transition-opacity duration-[var(--dur-micro)] data-[ending-style]:opacity-0 data-[instant]:transition-none data-[starting-style]:opacity-0">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
