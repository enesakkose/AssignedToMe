"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { buttonVariants } from "./button-variants";

/** A centred dialog: scales in from 0.95 over a dimmed page; the close button and Esc leave it. */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  closeLabel,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-scrim transition-opacity duration-[var(--dur-short)] ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <BaseDialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[16px] border border-rule-2 bg-paper p-5 shadow-float outline-none",
            "transition-[opacity,scale] duration-[var(--dur-short)] ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <BaseDialog.Title className="font-display text-lg font-semibold">
              {title}
            </BaseDialog.Title>
            <BaseDialog.Close
              aria-label={closeLabel}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "-mt-1 -mr-1.5 shrink-0",
              )}
            >
              <X />
            </BaseDialog.Close>
          </div>
          {description && (
            <BaseDialog.Description className="text-md text-ink-2">
              {description}
            </BaseDialog.Description>
          )}
          {children}
          {footer && <div className="flex justify-end gap-2">{footer}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
