"use client";

import { Popover as BasePopover } from "@base-ui/react/popover";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { buttonVariants, floatingPanelClass } from "./button-variants";

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof BasePopover.Popup> & {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-50"
      >
        <BasePopover.Popup className={cn(floatingPanelClass, "p-3", className)} {...props} />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

/** Top row of a popover: its title, optional extras, and a close button. */
export function PopoverHeader({
  title,
  closeLabel,
  children,
}: {
  title: string;
  closeLabel: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <BasePopover.Title className="min-w-0 flex-1 truncate font-display text-md font-semibold">
        {title}
      </BasePopover.Title>
      {children}
      <BasePopover.Close
        aria-label={closeLabel}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-my-1 -mr-1.5 shrink-0")}
      >
        <X />
      </BasePopover.Close>
    </div>
  );
}
