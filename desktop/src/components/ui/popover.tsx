import { Popover as BasePopover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { floatingPanelClass } from './menu';

export const Popover = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverTitle = BasePopover.Title;

export function PopoverContent({
  className,
  align = 'start',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof BasePopover.Popup> & { align?: 'start' | 'center' | 'end'; sideOffset?: number }) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} sideOffset={sideOffset} collisionPadding={8} className="z-50">
        <BasePopover.Popup data-floating className={cn(floatingPanelClass, 'p-3', className)} {...props} />
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

/** Top row of a popover: its title (or any content), optional actions, and a close button at the top right. */
export function PopoverHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {typeof title === 'string' ? (
        <PopoverTitle className="min-w-0 flex-1 truncate font-display text-md font-semibold">{title}</PopoverTitle>
      ) : (
        <div className="min-w-0 flex-1">{title}</div>
      )}
      {children}
      <BasePopover.Close render={<Button type="button" variant="ghost" size="icon" aria-label={t('ui.close')} className="-my-1 -mr-1.5 shrink-0" />}>
        <X />
      </BasePopover.Close>
    </div>
  );
}
