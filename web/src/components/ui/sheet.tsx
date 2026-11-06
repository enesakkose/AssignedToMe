"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactElement, ReactNode } from "react";

/**
 * A panel that slides in from the left edge over a dimmed page: the sidebar on screens too narrow to keep it open.
 * It leaves the way it came. `trigger` is the button that opens it.
 */
export function Sheet({
  trigger,
  title,
  open,
  onOpenChange,
  children,
}: {
  trigger: ReactElement;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Trigger render={trigger} />
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-scrim transition-opacity duration-[var(--dur-short)] ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-3rem))] flex-col bg-band shadow-float outline-none transition-transform duration-[var(--dur-short)] ease-[var(--ease-drawer)] data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full">
          <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
