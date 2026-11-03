import { cn } from '@/lib/cn';

/**
 * The app icon at header size: the "pulled task + dot" mark on a graphite tile, identical in light and dark.
 * Uses the small-size cut from desktop/design/logo/mytask-symbol-small.svg so bars and gaps stay crisp at 20 px.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('size-5 shrink-0', className)} aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="23" rx="5.5" fill="var(--color-brand-tile)" stroke="var(--color-rule-2)" />
      <g fill="var(--color-brand-mark)" transform="translate(12 12) scale(0.064) translate(-128 -128)">
        <rect x="24" y="24" width="152" height="56" rx="28" />
        <circle cx="53" cy="128" r="29" />
        <rect x="106" y="100" width="126" height="56" rx="28" />
        <rect x="24" y="176" width="152" height="56" rx="28" />
      </g>
    </svg>
  );
}
