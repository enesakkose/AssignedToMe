import { activeFilterCount, emptyFilters, filterOptions, getProvider, matchesFilters, matchesQuery, sortTasks } from '@mytask/core';
import { invoke } from '@tauri-apps/api/core';
import { AppWindowMac, Inbox, ListFilter, Plus, RefreshCw, SearchX, Settings } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/app-header';
import { AppLogo } from '@/components/ui/app-logo';
import { Button, IconButton } from '@/components/ui/button';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchField } from '@/components/ui/search-field';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/state';
import { Tab, Tabs, TabsList } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import type { StoredConnection } from '@/features/connections/api/connections';
import { useConnections } from '@/features/connections/hooks/use-connections';
import { UpdateBanner } from '@/features/updates/update-banner';
import { errorText } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { openExternal } from '@/lib/open-external';
import { isAppWindow } from '@/lib/windows';
import { ALL_BOARDS, useNav } from '@/stores/nav';
import { BoardActions, RenameBoardDialog } from '../components/board-actions';
import { BoardSwitcher } from '../components/board-switcher';
import { ActiveFilters, FilterMenu } from '../components/filter-menu';
import { TaskRow, TaskRowSkeleton } from '../components/task-row';
import { useBoardTasks } from '../hooks/use-board-tasks';
import { useBoardFilters } from '../hooks/use-filters';
import { useRemoteSearch } from '../hooks/use-remote-search';

export function TasksScreen() {
  const { t } = useTranslation();
  const go = useNav((s) => s.go);
  const board = useNav((s) => s.board);
  const selectBoard = useNav((s) => s.selectBoard);
  const showTabs = useNav((s) => s.showTabs);
  const connections = useConnections();
  const boards = connections.data ?? [];
  const results = useBoardTasks(boards);
  const [renaming, setRenaming] = useState<StoredConnection | null>(null);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘F focuses search on this screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isAll = board === ALL_BOARDS || !boards.some((b) => b.id === board);
  const visible = isAll ? boards.map((b, i) => ({ board: b, result: results[i]! })) : [];
  if (!isAll) {
    const i = boards.findIndex((b) => b.id === board);
    visible.push({ board: boards[i]!, result: results[i]! });
  }
  const allTasks = sortTasks(visible.flatMap((v) => v.result.data ?? []));
  const [filters, setFilters] = useBoardFilters(isAll ? ALL_BOARDS : board);
  const options = filterOptions(allTasks);
  const filtering = activeFilterCount(filters) > 0;
  const tasks = allTasks.filter((task) => matchesFilters(task, filters) && matchesQuery(task, query));
  // "All" searches only my tasks; a single board also searches its source.
  const remote = useRemoteSearch(isAll ? [] : visible.map((v) => v.board), query, allTasks);
  const shownIds = new Set(tasks.map((task) => task.id));
  const remoteTasks = remote.tasks.filter((task) => !shownIds.has(task.id) && matchesFilters(task, filters));
  const sourceNames = [...new Set(visible.map((v) => getProvider(v.board.providerId)?.name).filter(Boolean))].join(', ');
  const nothingFound = !!query.trim() && !tasks.length && (!remote.active || (!remote.pending && !remoteTasks.length));
  const filteredOut = filtering && !query.trim() && !tasks.length && allTasks.length > 0;
  const providerOf = (connectionId: string) => getProvider(boards.find((b) => b.id === connectionId)?.providerId ?? '');
  const failed = visible.filter((v) => v.result.isError);
  const loading = visible.some((v) => v.result.isPending);
  const fetching = results.some((r) => r.isFetching);
  const lastUpdated = Math.min(...visible.map((v) => v.result.dataUpdatedAt).filter(Boolean));
  const activeBoard = isAll ? undefined : visible[0]?.board;

  const refresh = () => Promise.all(visible.map((v) => v.result.refetch()));
  // The list (and with it search and filters) shows unless the store failed or there are no boards yet.
  const showList = !connections.isError && !(connections.isSuccess && boards.length === 0);
  const search = (
    <SearchField
      ref={searchRef}
      value={query}
      onValueChange={setQuery}
      // With tabs hidden the board's name stays off screen, here too.
      label={isAll ? t('tasks.searchAll') : showTabs ? t('tasks.searchBoard', { name: activeBoard?.name }) : t('tasks.searchThisBoard')}
      className="min-w-0 flex-1"
    />
  );
  const filterMenu = <FilterMenu filters={filters} onChange={setFilters} options={options} />;
  const open = (url: string) => openExternal(url).catch(() => toast.error(t('errors.openLink')));

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        // The window's title bar carries no app name: its toolbar search sits centred instead.
        leading={isAppWindow ? undefined : <AppLogo />}
        title={t('tasks.title')}
        center={
          isAppWindow ? (
            showList ? (
              // Filter sits right beside the search it narrows.
              <div className="flex w-full max-w-md items-center gap-2">
                {search}
                {filterMenu}
              </div>
            ) : (
              <span />
            )
          ) : undefined
        }
        actions={
          <>
            {/* The window lists boards in its sidebar, so it only needs the current board's actions here. */}
            {isAppWindow
              ? activeBoard && <BoardActions key={activeBoard.id} board={activeBoard} onRefresh={refresh} />
              : boards.length > 0 && (
              <BoardSwitcher
                boards={boards}
                counts={Object.fromEntries(boards.map((b, i) => [b.id, results[i]?.data?.length]))}
                total={results.reduce((n, r) => n + (r.data?.length ?? 0), 0)}
                active={isAll ? ALL_BOARDS : board}
              />
            )}
            {/* From the menubar to the full window; the popover then hides on its own as focus moves. */}
            {!isAppWindow && (
              <IconButton label={t('window.open')} onClick={() => void invoke('show_app_window').catch(() => undefined)}>
                <AppWindowMac />
              </IconButton>
            )}
            <IconButton label={t('settings.title')} onClick={() => go({ name: 'settings' })}>
              <Settings />
            </IconButton>
          </>
        }
      />

      {connections.isError ? (
        <ErrorState
          title={t('errors.storeTitle')}
          description={t('errors.store')}
          action={
            <Button size="sm" onClick={() => connections.refetch()}>
              {t('ui.retry')}
            </Button>
          }
        />
      ) : connections.isSuccess && boards.length === 0 ? (
        <EmptyState
          className="flex-1 justify-center"
          icon={<Inbox />}
          title={t('tasks.noBoardsTitle')}
          description={t('tasks.noBoardsDescription')}
          action={
            <Button variant="primary" onClick={() => go({ name: 'connection' })}>
              <Plus />
              {t('connections.add')}
            </Button>
          }
        />
      ) : (
        <>
          {showTabs && !isAppWindow && (
          <div className="flex items-center border-b border-rule pr-2">
            <Tabs value={isAll ? ALL_BOARDS : board} onValueChange={(v) => selectBoard(String(v))} className="min-w-0 flex-1">
              <TabsList className="border-b-0">
                <Tab value={ALL_BOARDS} count={boards.length ? results.reduce((n, r) => n + (r.data?.length ?? 0), 0) : undefined}>
                  {t('tasks.all')}
                </Tab>
                {boards.map((b, i) => {
                  const provider = getProvider(b.providerId);
                  return (
                    <Tab
                      key={b.id}
                      value={b.id}
                      count={results[i]?.data?.length}
                      icon={provider && <ProviderLogo provider={provider} size="sm" />}
                      onDoubleClick={() => setRenaming(b)}
                    >
                      {b.name}
                    </Tab>
                  );
                })}
              </TabsList>
            </Tabs>
            {activeBoard && <BoardActions key={activeBoard.id} board={activeBoard} onRefresh={refresh} />}
          </div>
          )}
          {isAppWindow ? (
            // Just the active filter chips; the search and filter button are in the title bar. Hidden when none.
            <div className="shrink-0 border-b border-rule px-3 pb-2 empty:hidden">
              <ActiveFilters filters={filters} onChange={setFilters} options={options} />
            </div>
          ) : (
            <div className="shrink-0 border-b border-rule px-3 py-2">
              <div className="flex items-center gap-2">
                {search}
                {filterMenu}
              </div>
              <ActiveFilters filters={filters} onChange={setFilters} options={options} />
            </div>
          )}

          <ScrollArea className="flex-1">
            {failed.map(({ board: b, result }) => (
              <ErrorState
                key={b.id}
                title={t('tasks.errorTitle', { name: showTabs ? b.name : (getProvider(b.providerId)?.name ?? '') })}
                description={
                  // A board added by signing in whose sign-in has ended (or that came over by QR and never signed in here).
                  getProvider(b.providerId)?.signIn && (result.error as { code?: string } | null)?.code === 'unauthorized'
                    ? t('tasks.signInAgain')
                    : errorText(result.error, t, getProvider(b.providerId)?.appName)
                }
                action={
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => result.refetch()}>
                      {t('ui.retry')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => go({ name: 'connection', id: b.id })}>
                      {getProvider(b.providerId)?.signIn ? t('tasks.signIn') : t('connections.edit')}
                    </Button>
                  </div>
                }
              />
            ))}
            {loading && !allTasks.length ? (
              <ul aria-busy>
                <TaskRowSkeleton />
                <TaskRowSkeleton />
                <TaskRowSkeleton />
              </ul>
            ) : filteredOut ? (
              <EmptyState
                icon={<ListFilter />}
                title={t('filters.noMatch')}
                description={t('filters.noMatchHint')}
                action={
                  <Button size="sm" onClick={() => setFilters(emptyFilters())}>
                    {t('filters.clear')}
                  </Button>
                }
              />
            ) : nothingFound ? (
              <EmptyState
                icon={<SearchX />}
                title={t('tasks.noResults', { query: query.trim() })}
                description={remote.failed ? errorText(remote.failed, t, getProvider(activeBoard?.providerId ?? '')?.appName) : t('tasks.noResultsHint')}
                action={
                  <Button size="sm" onClick={() => setQuery('')}>
                    {t('ui.clearSearch')}
                  </Button>
                }
              />
            ) : tasks.length || remote.active ? (
              <>
                {tasks.length > 0 && (
                  <ul>
                    {tasks.map((task) => (
                      <TaskRow key={task.id} task={task} provider={providerOf(task.connectionId)} onOpen={open} />
                    ))}
                  </ul>
                )}
                {remote.active && (
                  <section aria-busy={remote.pending || undefined}>
                    <h3 className="flex h-8 items-center gap-2 border-b border-rule bg-paper-2 px-3 font-display text-xs font-semibold text-muted">
                      {t('tasks.moreInSource', { name: sourceNames })}
                      {remote.pending && <Spinner className="size-3" />}
                    </h3>
                    {remoteTasks.length > 0 ? (
                      <ul>
                        {remoteTasks.map((task) => (
                          <TaskRow key={task.id} task={task} provider={providerOf(task.connectionId)} onOpen={open} />
                        ))}
                      </ul>
                    ) : (
                      !remote.pending && (
                        <p className="px-3 py-3 text-sm text-muted">
                          {remote.failed ? errorText(remote.failed, t, getProvider(activeBoard?.providerId ?? '')?.appName) : t('tasks.noMoreInSource', { name: sourceNames })}
                        </p>
                      )
                    )}
                  </section>
                )}
              </>
            ) : (
              !failed.length && <EmptyState icon={<Inbox />} title={t('tasks.emptyTitle')} description={t('settings.refreshHint')} />
            )}
          </ScrollArea>

          <UpdateBanner />
          <footer className="flex h-8 shrink-0 items-center justify-between border-t border-rule pr-1.5 pl-3 text-xs text-muted">
            <span className="num">
              {fetching
                ? t('tasks.refreshing')
                : Number.isFinite(lastUpdated)
                  ? t('tasks.updated', { time: timeAgo(new Date(lastUpdated).toISOString()) })
                  : null}
            </span>
            <IconButton label={t('tasks.refreshShortcut')} onClick={refresh} disabled={!boards.length || fetching}>
              {fetching ? <Spinner /> : <RefreshCw />}
            </IconButton>
          </footer>
        </>
      )}

      {renaming && (
        <RenameBoardDialog board={renaming} open onOpenChange={(o) => !o && setRenaming(null)} />
      )}
    </div>
  );
}
