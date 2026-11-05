import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: ReactNode; icon?: ReactNode };

/** One-of-few choice shown inline, e.g. theme. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => next[0] && onValueChange(next[0] as T)}
      className={cn('inline-flex rounded-control bg-paper-3 p-0.5', className)}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          className={cn(
            'flex h-6 items-center gap-1 rounded-control px-2.5 font-display text-sm font-medium text-muted',
            'transition-colors duration-[var(--dur-micro)] hover:text-ink',
            'data-[pressed]:bg-paper data-[pressed]:text-ink dark:data-[pressed]:bg-accent-wash [&_svg]:size-3.5',
          )}
        >
          {o.icon}
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
