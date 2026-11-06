"use client";

import { Button as BaseButton } from "@base-ui/react/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

import { buttonVariants } from "./button-variants";
import { Tooltip } from "./tooltip";

type ButtonProps = ComponentProps<typeof BaseButton> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <BaseButton className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** Icon-only button. `label` names it for screen readers and shows as its tooltip. */
export function IconButton({
  label,
  ...props
}: Omit<ButtonProps, "size" | "aria-label"> & { label: string }) {
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon" aria-label={label} {...props} />
    </Tooltip>
  );
}
