import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex h-[18px] max-w-full shrink-0 items-center rounded-full px-2 font-display text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-paper-3 text-ink-2',
        progress: 'bg-progress/15 text-progress',
        success: 'bg-success/15 text-success',
        error: 'bg-error/15 text-error',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({ className, tone, children, ...props }: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      <span className="truncate">{children}</span>
    </span>
  );
}
