import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = BaseTabs.Root;
export const TabsPanel = BaseTabs.Panel;

/** Horizontally scrolling tab strip with a sliding graphite underline. */
export function TabsList({ className, children, ...props }: ComponentProps<typeof BaseTabs.List>) {
  const ref = useRef<HTMLDivElement>(null);
  // A mouse wheel only scrolls vertically; translate it to horizontal so the tabs scroll with a mouse too, not just a trackpad.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <BaseTabs.List
      ref={ref}
      className={cn(
        'relative flex items-stretch gap-0.5 overflow-x-auto border-b border-rule px-2 [scrollbar-width:none]',
        className,
      )}
      {...props}
    >
      {children}
      <BaseTabs.Indicator
        className={cn(
          'absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-accent',
          'w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)]',
          'transition-[translate,width] duration-[var(--dur-short)] ease-out',
        )}
      />
    </BaseTabs.List>
  );
}

type TabProps = ComponentProps<typeof BaseTabs.Tab> & { count?: number; icon?: ReactNode };

export function Tab({ className, children, count, icon, ...props }: TabProps) {
  return (
    <BaseTabs.Tab
      className={cn(
        'group flex h-8 shrink-0 items-center gap-1.5 rounded-t-sm px-2 font-display text-md font-medium text-muted',
        'transition-colors duration-[var(--dur-micro)] hover:text-ink data-[active]:text-ink',
        'focus-visible:outline-offset-[-2px] data-[disabled]:opacity-45',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="max-w-32 truncate" title={typeof children === 'string' ? children : undefined}>
        {children}
      </span>
      {count !== undefined && (
        <span className="num rounded-sm bg-paper-3 px-1 text-xs text-muted group-data-[active]:bg-accent-wash group-data-[active]:text-accent-text">
          {count}
        </span>
      )}
    </BaseTabs.Tab>
  );
}
