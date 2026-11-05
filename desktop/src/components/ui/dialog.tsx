import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './button';

const backdropClass =
  'fixed inset-0 z-40 rounded-window bg-backdrop transition-opacity duration-[var(--dur-short)] ease-out data-[starting-style]:opacity-0 data-[ending-style]:opacity-0';

const popupClass = cn(
  'cut fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-96 -translate-x-1/2 -translate-y-1/2 flex-col gap-3',
  'border border-rule bg-paper p-4 shadow-float outline-none',
  'transition-[opacity,scale] duration-[var(--dur-short)] ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
);

const titleClass = 'font-display text-lg font-semibold tracking-[var(--tracking-display)]';
const descriptionClass = 'text-md text-ink-2';

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const { t } = useTranslation();
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdropClass} />
        <BaseDialog.Popup className={popupClass}>
          <div className="flex items-start justify-between gap-2">
            <BaseDialog.Title className={titleClass}>{title}</BaseDialog.Title>
            {/* The house icon button, like the popover's close. */}
            <BaseDialog.Close render={<Button variant="ghost" size="icon" aria-label={t('ui.close')} className="-mt-1 -mr-1.5 shrink-0" />}>
              <X />
            </BaseDialog.Close>
          </div>
          {description && <BaseDialog.Description className={descriptionClass}>{description}</BaseDialog.Description>}
          {children}
          {footer && <div className="mt-1 flex justify-end gap-2">{footer}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

type ConfirmDialogProps = Omit<DialogProps, 'children' | 'footer'> & {
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'default' | 'danger';
};

/** For destructive or irreversible actions. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, tone = 'danger' }: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <BaseAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop className={backdropClass} />
        <BaseAlertDialog.Popup className={popupClass}>
          <BaseAlertDialog.Title className={titleClass}>{title}</BaseAlertDialog.Title>
          {description && (
            <BaseAlertDialog.Description className={descriptionClass}>{description}</BaseAlertDialog.Description>
          )}
          <div className="mt-1 flex justify-end gap-2">
            <BaseAlertDialog.Close render={<Button size="sm" variant="ghost" />}>{t('ui.cancel')}</BaseAlertDialog.Close>
            <Button
              size="sm"
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </BaseAlertDialog.Popup>
      </BaseAlertDialog.Portal>
    </BaseAlertDialog.Root>
  );
}
