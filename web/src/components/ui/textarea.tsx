import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/** Multi-line text, the same edge and focus ring as `Input`, with a field's radius. */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={3}
      spellCheck={false}
      className={cn(
        "min-h-20 w-full min-w-0 resize-y rounded-[12px] border border-edge bg-paper px-3.5 py-2.5 text-md text-ink",
        "placeholder:text-muted/70 transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-out hover:border-muted",
        "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_18%,transparent)] focus-visible:outline-none",
        "aria-[invalid=true]:border-error",
        className,
      )}
      {...props}
    />
  );
}
