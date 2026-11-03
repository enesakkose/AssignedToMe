import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-paper-3 px-1',
        'font-mono text-xs text-muted',
        className,
      )}
      {...props}
    />
  );
}
