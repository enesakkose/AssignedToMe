import { Check, ChevronDown } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

/** A compact, text-style dropdown for the composer footer (model, permission mode…), like Claude's input controls. */
export function TextMenu<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Menu>
      <MenuTrigger disabled={disabled} className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink disabled:opacity-60">
        {current?.label}
        <ChevronDown className="size-3 shrink-0" aria-hidden />
      </MenuTrigger>
      <MenuContent align="end">
        {options.map((o) => (
          <MenuItem key={o.value} icon={value === o.value ? <Check /> : <span className="size-3.5" />} onClick={() => onChange(o.value)}>
            {o.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
