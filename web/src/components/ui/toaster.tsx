"use client";

import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

/** Toasts as on desktop: a quiet panel at the bottom centre, with an undo action where an action can be undone. */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={6}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(380px,calc(100vw-32px))] items-start gap-2 rounded-[12px] border border-rule-2 bg-paper p-3 text-md text-ink shadow-float",
          title: "font-medium",
          description: "text-sm text-muted",
          icon: "mt-0.5 [&_svg]:size-4",
          error: "[&_[data-icon]]:text-error",
          success: "[&_[data-icon]]:text-success",
          actionButton:
            "ml-auto shrink-0 font-display text-sm font-medium text-accent-text hover:underline",
        },
      }}
    />
  );
}
