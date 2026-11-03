import { Input as BaseInput } from '@base-ui/react/input';
import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export const inputClass = cn(
  'h-[var(--control-md)] w-full min-w-0 rounded-control border border-rule-2 bg-paper px-3.5 text-md text-ink',
  'placeholder:text-muted/70 transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-out',
  'hover:border-muted/60',
  'focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent)_18%,transparent)]',
  'data-[invalid]:border-error aria-[invalid=true]:border-error',
  'disabled:cursor-not-allowed disabled:bg-paper-2 disabled:text-muted',
);

export function Input({ className, ...props }: ComponentProps<typeof BaseInput>) {
  return <BaseInput className={cn(inputClass, className)} spellCheck={false} autoComplete="off" {...props} />;
}

/** Password-style input with a reveal toggle. Value never leaves the field. */
export function SecretInput({ className, ...props }: Omit<ComponentProps<typeof BaseInput>, 'type'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const label = visible ? t('ui.hide') : t('ui.show');
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-9 font-mono', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-control text-muted hover:text-ink"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  );
}
