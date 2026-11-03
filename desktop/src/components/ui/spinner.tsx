import { cn } from '@/lib/cn';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn('size-3.5 animate-spin', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
