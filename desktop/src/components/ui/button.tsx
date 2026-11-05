import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';
import { Tooltip } from './tooltip';

// Flat pills: one solid fill, no shadow or edge. Press feedback is a slight scale.
const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap select-none',
    'font-display font-medium rounded-control',
    'transition-[scale,background-color,color] duration-[var(--dur-micro)] ease-out active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-45 data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
    '[&_svg]:size-3.5 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
        secondary: 'bg-paper-3 text-ink hover:bg-rule-2',
        ghost: 'text-ink-2 hover:bg-paper-3 hover:text-ink',
        danger: 'bg-error-wash text-error hover:bg-[color-mix(in_oklab,var(--color-error)_16%,var(--color-paper))]',
      },
      size: {
        sm: 'h-[var(--control-sm)] px-3 text-sm',
        md: 'h-[var(--control-md)] px-4 text-md',
        icon: 'size-[var(--control-sm)] p-0',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

type ButtonProps = ComponentProps<typeof BaseButton> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
  };

export function Button({ className, variant, size, loading, disabled, children, ...props }: ButtonProps) {
  return (
    <BaseButton
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      focusableWhenDisabled={loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </BaseButton>
  );
}

/** Icon-only button. `label` is required for screen readers and the tooltip. */
export function IconButton({ label, ...props }: Omit<ButtonProps, 'size' | 'aria-label'> & { label: string }) {
  return (
    <Tooltip content={label}>
      <Button variant="ghost" size="icon" aria-label={label} {...props} />
    </Tooltip>
  );
}
