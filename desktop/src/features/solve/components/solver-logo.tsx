import { cn } from '@/lib/cn';
import { solverOf } from '../solvers';
import type { SolverId } from '../types';

/**
 * The solver's mark (a trusted built-in SVG constant). A colored logo renders in an <img> so it keeps its brand
 * color; a monochrome one (currentColor) renders inline and follows the theme's ink — forced, so a muted menu
 * context can't grey it out.
 */
export function SolverLogo({ solver, className }: { solver: SolverId; className?: string }) {
  const s = solverOf(solver);
  if (s.logo.includes('currentColor')) {
    return (
      <span
        role="img"
        aria-label={s.name}
        className={cn('inline-flex shrink-0 items-center justify-center text-ink [&>svg]:size-full [&>svg]:!text-ink', className)}
        dangerouslySetInnerHTML={{ __html: s.logo }}
      />
    );
  }
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', className)}>
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(s.logo)}`} alt={s.name} className="size-full" draggable={false} />
    </span>
  );
}
