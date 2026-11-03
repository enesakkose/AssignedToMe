import { Separator as BaseSeparator } from '@base-ui/react/separator';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Separator({ className, ...props }: ComponentProps<typeof BaseSeparator>) {
  return (
    <BaseSeparator
      className={cn('shrink-0 bg-rule data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px', className)}
      {...props}
    />
  );
}
