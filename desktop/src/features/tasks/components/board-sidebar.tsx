import { getProvider } from '@mytask/core';
import { Inbox, PanelLeft, Plus } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '@/components/ui/button';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { useConnections } from '@/features/connections/hooks/use-connections';
import { cn } from '@/lib/cn';
import { ALL_BOARDS, useNav } from '@/stores/nav';
import { useBoardTasks } from '../hooks/use-board-tasks';

/** App window only: the boards as a sidebar instead of tabs. Its top strip is title bar: traffic lights and the toggle. */
export function BoardSidebar() {
  const { t } = useTranslation();
  const boards = useConnections().data ?? [];
  const results = useBoardTasks(boards);
  const board = useNav((s) => s.board);
  const onTasks = useNav((s) => s.screen.name === 'tasks');
  const selectBoard = useNav((s) => s.selectBoard);
  const go = useNav((s) => s.go);
  const isAll = board === ALL_BOARDS || !boards.some((b) => b.id === board);
  // Picking a board always lands on its list, from settings or a task page too.
  const pick = (id: string) => {
    selectBoard(id);
    go({ name: 'tasks' });
  };

  return (
    <nav aria-label={t('settings.boards')} className="flex w-56 shrink-0 flex-col border-r border-rule bg-paper-2">
      <div data-tauri-drag-region className="h-11 shrink-0" />
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-1">
        <SidebarItem
          active={onTasks && isAll}
          onClick={() => pick(ALL_BOARDS)}
          icon={<Inbox className="size-4 text-muted" />}
          label={t('tasks.all')}
          count={boards.length ? results.reduce((n, r) => n + (r.data?.length ?? 0), 0) : undefined}
        />
        {boards.map((b, i) => {
          const provider = getProvider(b.providerId);
          return (
            <SidebarItem
              key={b.id}
              active={onTasks && !isAll && board === b.id}
              onClick={() => pick(b.id)}
              icon={provider && <ProviderLogo provider={provider} size="sm" />}
              label={b.name}
              count={results[i]?.data?.length}
            />
          );
        })}
      </ul>
      <div className="shrink-0 p-2">
        <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => go({ name: 'connection' })}>
          <Plus />
          {t('connections.add')}
        </Button>
      </div>
    </nav>
  );
}

function SidebarItem({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count?: number }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-8 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-md text-ink-2 transition-colors hover:bg-paper-2 focus-visible:outline-offset-[-2px]',
          active && 'bg-paper-3 font-medium text-ink',
        )}
      >
        <span className="flex w-4 shrink-0 justify-center">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {count != null && <span className="num shrink-0 text-xs text-muted">{count}</span>}
      </button>
    </li>
  );
}

/** Shows/hides the sidebar. Fixed beside the traffic lights so it stays put whether the sidebar is open or not. */
export function SidebarToggle() {
  const { t } = useTranslation();
  const open = useNav((s) => s.sidebarOpen);
  const toggle = useNav((s) => s.toggleSidebar);
  // The header makes room for the traffic lights and this button only while the sidebar is hidden (globals.css).
  useEffect(() => {
    document.documentElement.dataset.sidebar = open ? 'open' : 'closed';
  }, [open]);
  return (
    // About one traffic-light gap to the right of the green light, as macOS toolbars space it.
    <div className="fixed top-[9px] left-[84px] z-50">
      {/* A rounded square like macOS toolbar buttons, not the app's pill, so it reads as part of the title bar. */}
      <IconButton label={open ? t('window.hideSidebar') : t('window.showSidebar')} onClick={toggle} className="rounded-sm">

        <PanelLeft />
      </IconButton>
    </div>
  );
}
