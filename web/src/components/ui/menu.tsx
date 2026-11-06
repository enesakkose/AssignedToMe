"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { floatingPanelClass } from "./button-variants";

export const Menu = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;
export const MenuGroup = BaseMenu.Group;
export const MenuRadioGroup = BaseMenu.RadioGroup;

export function MenuContent({
  className,
  align = "end",
  side = "bottom",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof BaseMenu.Popup> & {
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  sideOffset?: number;
}) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={8}
        className="z-50"
      >
        <BaseMenu.Popup className={cn(floatingPanelClass, "min-w-48", className)} {...props} />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

const itemClass = cn(
  "flex h-[var(--control-sm)] cursor-default items-center gap-2 rounded-sm px-2 text-md text-ink outline-none select-none",
  "data-[highlighted]:bg-paper-3 data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
);

export function MenuGroupLabel({
  className,
  ...props
}: ComponentProps<typeof BaseMenu.GroupLabel>) {
  return (
    <BaseMenu.GroupLabel
      className={cn("px-2 pt-2 pb-1 text-xs font-medium text-muted", className)}
      {...props}
    />
  );
}

export function MenuItem({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.Item> & { icon?: ReactNode }) {
  return (
    <BaseMenu.Item className={cn(itemClass, "[&_svg]:text-muted", className)} {...props}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
    </BaseMenu.Item>
  );
}

/** A tick in a fixed column, so ticked and unticked labels line up. */
const Tick = ({ children }: { children: ReactNode }) => (
  <span className="grid size-4 place-items-center">{children}</span>
);

export function MenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.CheckboxItem>) {
  return (
    <BaseMenu.CheckboxItem className={cn(itemClass, className)} {...props}>
      <Tick>
        <BaseMenu.CheckboxItemIndicator>
          <Check />
        </BaseMenu.CheckboxItemIndicator>
      </Tick>
      <span className="flex-1 truncate">{children}</span>
    </BaseMenu.CheckboxItem>
  );
}

export function MenuRadioItem({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.RadioItem> & { icon?: ReactNode }) {
  return (
    <BaseMenu.RadioItem className={cn(itemClass, "[&>svg]:text-muted", className)} {...props}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      <BaseMenu.RadioItemIndicator>
        <Check />
      </BaseMenu.RadioItemIndicator>
    </BaseMenu.RadioItem>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn("-mx-1 my-1 h-px bg-rule", className)} />;
}
