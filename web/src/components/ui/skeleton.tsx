import { cn } from "@/lib/cn";

/** A placeholder in the shape of what is loading; stills under reduced motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-paper-3", className)} />;
}
