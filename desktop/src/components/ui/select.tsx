import { Select as BaseSelect } from '@base-ui/react/select';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { inputClass } from './input';
import { floatingPanelClass } from './menu';

type Option = { value: string; label: string };

type SelectProps = {
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: Option[];
  placeholder?: string;
  id?: string;
  invalid?: boolean;
  className?: string;
};

/** One choice from a list, styled like the inputs. Use inside `Field` for the label and errors. */
export function Select({ value, onValueChange, options, placeholder, id, invalid, className }: SelectProps) {
  return (
    <BaseSelect.Root items={options} value={value} onValueChange={(v) => onValueChange(v as string | null)}>
      <BaseSelect.Trigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, 'flex items-center justify-between gap-2 text-left', className)}
      >
        <BaseSelect.Value placeholder={placeholder} className="min-w-0 truncate data-[placeholder]:text-muted/70" />
        <BaseSelect.Icon className="shrink-0 text-muted">
          <ChevronsUpDown className="size-3.5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner alignItemWithTrigger={false} sideOffset={4} collisionPadding={8} className="z-[60]">
          <BaseSelect.Popup data-floating className={cn(floatingPanelClass, 'min-w-[var(--anchor-width)]')}>
            <BaseSelect.List className="max-h-[min(16rem,var(--available-height))] overflow-y-auto">
              {options.map((o) => (
                <BaseSelect.Item
                  key={o.value}
                  value={o.value}
                  className="flex h-7 cursor-default items-center gap-2 rounded-sm px-2 text-md outline-none data-[highlighted]:bg-paper-3"
                >
                  <BaseSelect.ItemText className="min-w-0 flex-1 truncate">{o.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator>
                    <Check className="size-3.5 text-ink-2" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
