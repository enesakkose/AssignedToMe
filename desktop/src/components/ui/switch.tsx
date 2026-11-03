import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root
      className={cn(
        'relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full bg-track p-0.5',
        'transition-colors duration-[var(--dur-micro)] ease-out',
        'data-[checked]:bg-accent',
        'data-[disabled]:opacity-45',
        className,
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          'size-3.5 rounded-full bg-thumb shadow-[0_1px_2px_oklch(0%_0_0/0.3)]',
          'transition-[translate,background-color] duration-[var(--dur-short)] ease-out data-[checked]:translate-x-3 data-[checked]:bg-accent-ink',
        )}
      />
    </BaseSwitch.Root>
  );
}
