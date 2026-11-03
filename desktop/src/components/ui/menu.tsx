import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Shared by every floating panel: grows from its trigger, fades out. */
export const floatingPanelClass = cn(
  'cut border border-rule bg-paper p-1 shadow-float outline-none',
  'origin-[var(--transform-origin)] transition-[opacity,scale] duration-[var(--dur-micro)] ease-out',
  'data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
);

export const Menu = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof BaseMenu.Popup> & { align?: 'start' | 'center' | 'end'; sideOffset?: number }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <BaseMenu.Popup data-floating className={cn(floatingPanelClass, 'min-w-40', className)} {...props} />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

type MenuItemProps = ComponentProps<typeof BaseMenu.Item> & {
  icon?: ReactNode;
  shortcut?: ReactNode;
  tone?: 'default' | 'danger';
};

export function MenuItem({ className, icon, shortcut, tone = 'default', children, ...props }: MenuItemProps) {
  return (
    <BaseMenu.Item
      className={cn(
        'flex h-7 items-center gap-2 rounded-sm px-2 text-md outline-none',
        'data-[highlighted]:bg-paper-3 data-[disabled]:opacity-45',
        '[&_svg]:size-3.5 [&_svg]:text-muted',
        tone === 'danger' && 'text-error [&_svg]:text-error',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut}
    </BaseMenu.Item>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn('my-1 h-px bg-rule', className)} />;
}
