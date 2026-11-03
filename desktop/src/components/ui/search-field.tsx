import { Search, X } from 'lucide-react';
import type { ComponentProps, Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { inputClass } from './input';

type SearchFieldProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name; also the placeholder. */
  label: string;
  ref?: Ref<HTMLInputElement>;
};

/** Pill search input with a clear button. Esc clears first, and only bubbles when already empty. */
export function SearchField({ value, onValueChange, label, className, ref, onKeyDown, ...props }: SearchFieldProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            e.stopPropagation();
            onValueChange('');
          }
          onKeyDown?.(e);
        }}
        spellCheck={false}
        autoComplete="off"
        className={cn(inputClass, 'h-8 pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden')}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={t('ui.clearSearch')}
          onClick={() => onValueChange('')}
          className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-paper-3 hover:text-ink"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
