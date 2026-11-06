import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

// The desktop badge: a small pill with a tinted fill, never an outline.
const badgeVariants = cva(
  "inline-flex h-5 max-w-full shrink-0 items-center rounded-full px-2 font-display text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-paper-3 text-ink-2",
        progress: "bg-progress/15 text-progress",
        error: "bg-error/15 text-error",
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  children,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span className="truncate">{children}</span>
    </span>
  );
}
