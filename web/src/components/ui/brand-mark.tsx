import { cn } from "@/lib/cn";

/**
 * The AssignedToMe mark ("Nokta", desktop/design/logo): three rounded bars, the middle one pulled out to the right with
 * a dot where it was. Flat, in the current text colour; no tile.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden
      className={cn("size-5 shrink-0", className)}
      fill="currentColor"
    >
      <rect x="24" y="24" width="152" height="56" rx="28" />
      <circle cx="53" cy="128" r="29" />
      <rect x="106" y="100" width="126" height="56" rx="28" />
      <rect x="24" y="176" width="152" height="56" rx="28" />
    </svg>
  );
}
