import { UserRound } from "lucide-react";

import { cn } from "@/lib/cn";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toLocaleUpperCase();
}

/** Initials in a circle; a dashed outline when nobody is assigned. Remote avatar images are never loaded. */
export function Avatar({ name, className }: { name?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
        name ? "bg-paper-3 text-ink-2" : "border border-dashed border-rule-2 text-muted",
        className,
      )}
    >
      {name ? initials(name) : <UserRound className="size-3" />}
    </span>
  );
}
