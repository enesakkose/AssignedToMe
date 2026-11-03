import { Field as BaseField } from '@base-ui/react/field';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type FieldProps = {
  label: ReactNode;
  description?: ReactNode;
  /** Shown and marks the control invalid when set. */
  error?: string;
  name?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + description/error. Wraps any control from components/ui. */
export function Field({ label, description, error, name, className, children }: FieldProps) {
  return (
    <BaseField.Root name={name} invalid={!!error} className={cn('flex flex-col gap-1', className)}>
      <BaseField.Label className="font-display text-sm font-medium text-ink-2">{label}</BaseField.Label>
      {children}
      {error ? (
        <BaseField.Error match className="text-sm text-error">
          {error}
        </BaseField.Error>
      ) : (
        description && <BaseField.Description className="text-sm text-muted">{description}</BaseField.Description>
      )}
    </BaseField.Root>
  );
}
