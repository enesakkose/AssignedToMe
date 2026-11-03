import type { ReactNode } from 'react';
import { isAppWindow } from '@/lib/windows';

type Props = {
  title: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  /** Shown centred in place of the title, e.g. the window's toolbar search; the title stays for screen readers. */
  center?: ReactNode;
};

/** Slim top bar of the popover: title on the left, actions on the right. */
export function AppHeader({ title, leading, actions, center }: Props) {
  // In the app window the header is the title bar: it drags the window (the popover must stay where it opened).
  const drag = isAppWindow || undefined;
  return (
    <header data-tauri-drag-region={drag} className="app-header flex h-11 shrink-0 items-center gap-2 border-b border-rule px-3">
      {leading}
      {center ? (
        <>
          <h1 className="sr-only">{title}</h1>
          <div data-tauri-drag-region={drag} className="flex min-w-0 flex-1 justify-center">
            {center}
          </div>
        </>
      ) : (
        <h1 data-tauri-drag-region={drag} className="min-w-0 flex-1 truncate text-lg">
          {title}
        </h1>
      )}
      {actions && <div className="flex items-center gap-0.5">{actions}</div>}
    </header>
  );
}
