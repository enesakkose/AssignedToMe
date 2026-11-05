import { getProvider, type RelatedTask, type Task } from '@mytask/core';
import { skipToken, useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Ban, Hash, House, Link2, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '@/components/layout/app-header';
import { IconButton } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Priority, StatusDot } from '@/components/ui/status';
import { toast } from '@/components/ui/toaster';
import { withSecrets } from '@/features/connections/api/connections';
import { useConnections } from '@/features/connections/hooks/use-connections';
import { cn } from '@/lib/cn';
import { http } from '@/lib/http';
import { timeAgo } from '@/lib/format';
import { openExternal } from '@/lib/open-external';
import { markForRefresh } from '@/lib/query';
import { useNav } from '@/stores/nav';
import { AssigneeMenu } from '../components/assignee-menu';
import { AttachmentImages } from '../components/attachment-images';
import { Comments } from '../components/comments';
import { LogWork } from '../components/log-work';
import { inlineImageIds, RichText } from '../components/rich-text';
import { SourceHtml } from '../components/source-html';
import { FailureNotice } from '../components/failure-notice';
import { StatusMenu } from '../components/status-menu';
import { copyTaskLink, SubtaskList, subtaskAsTask, TimeTracking } from '../components/task-row';
import { boardTasksOptions } from '../hooks/use-board-tasks';
import { useCanLogWork } from '../hooks/use-worklog';
import { TypeIcon } from '../components/type-icon';

/** A stand-in from what a link already tells us, shown while the full task loads. */
const relatedAsTask = (r: RelatedTask, connectionId: string): Task => ({
  id: `${connectionId}:${r.key}`,
  key: r.key,
  title: r.title,
  url: r.url,
  type: r.type,
  status: r.status ?? '',
  statusCategory: r.statusCategory ?? 'todo',
  connectionId,
  updatedAt: '',
});

/** A task or sub-task of this board's list, by key; sub-tasks come back as tasks with their parent. */
function findInBoard(tasks: Task[] | undefined, connectionId: string, match: (t: { id: string; key: string }) => boolean) {
  for (const task of tasks ?? []) {
    if (match(task)) return { task };
    const sub = task.subtasks?.find(match);
    if (sub) return { task: subtaskAsTask(sub, connectionId), parent: task };
  }
  return undefined;
}

/** Everything about one task on its own page, over the list (which keeps its search and scroll underneath). */
export function TaskDetailScreen({ snapshot }: { snapshot: Task }) {
  const { t } = useTranslation();
  const closeTask = useNav((s) => s.closeTask);
  const openTask = useNav((s) => s.openTask);
  const go = useNav((s) => s.go);
  const connections = useConnections();
  const connection = connections.data?.find((c) => c.id === snapshot.connectionId);
  // The board's own query (same options as the list), so status, time and assignee stay fresh here and refresh works.
  const refreshMs = useNav((s) => s.refreshMs);
  const board = useQuery(connection ? boardTasksOptions(connection, refreshMs) : { queryKey: ['tasks', snapshot.connectionId], queryFn: skipToken });
  const all = board.data as Task[] | undefined;
  const inBoard = findInBoard(all, snapshot.connectionId, (t) => t.id === snapshot.id || t.key === snapshot.key);
  // Not in your list (an epic, someone else's story, a linked issue): load it on its own.
  const provider = getProvider(connection?.providerId ?? '');
  const single = useQuery({
    queryKey: ['task', snapshot.connectionId, snapshot.key],
    queryFn: async () => provider!.getTask!(await withSecrets(connection!), snapshot.key, http),
    enabled: !inBoard && !!connection && !!provider?.getTask,
    staleTime: 60_000,
  });
  const { task, parent } = inBoard ?? { task: single.data ?? snapshot, parent: undefined };
  /** A related task opens here: from your list when it's there, else loaded on its own; only without that, in its source. */
  const goTo = (related: RelatedTask) => {
    const found = findInBoard(all, task.connectionId, (t) => t.key === related.key);
    if (found) openTask(found.task);
    else if (provider?.getTask) openTask(relatedAsTask(related, task.connectionId));
    else void open(related.url);
  };
  // Waiting on a task outside your list: show the frame, not half its fields popping in one by one.
  const loadingTask = !inBoard && single.isPending && single.fetchStatus !== 'idle';
  const html = useQuery({
    queryKey: ['description-html', task.connectionId, task.key],
    queryFn: async () => (await provider!.getDescriptionHtml!(await withSecrets(connection!), task.key, http)) ?? null,
    enabled: !!connection && !!provider?.getDescriptionHtml,
    staleTime: 60_000,
  });
  const isEpic = /epic/i.test(task.type ?? '');
  // An epic's issues, or any task that reports children (e.g. GitHub sub-issues), loaded on demand.
  const hasChildren = !!provider?.getChildren && (isEpic || (task.childCount ?? 0) > 0);
  const children = useQuery({
    queryKey: ['children', task.connectionId, task.key],
    queryFn: async () => provider!.getChildren!(await withSecrets(connection!), task, http),
    enabled: hasChildren && !!connection,
    staleTime: 60_000,
  });
  const parentTask: RelatedTask | undefined = task.parent ?? (parent && { key: parent.key, title: parent.title, url: parent.url, type: parent.type });
  const blockers = (task.links ?? []).filter((l) => l.blocksThis && l.statusCategory !== 'done');
  const qc = useQueryClient();
  const fetching =
    useIsFetching({ queryKey: ['tasks', task.connectionId] }) +
    useIsFetching({ queryKey: ['task', task.connectionId, snapshot.key] }) +
    useIsFetching({ queryKey: ['comments', task.connectionId, task.key] }) +
    useIsFetching({ queryKey: ['description-html', task.connectionId, task.key] }) +
    useIsFetching({ queryKey: ['children', task.connectionId, task.key] });
  // The board list owns the fetch, so refetching its query refreshes this task too.
  const refresh = () =>
    Promise.all([
      inBoard ? board.refetch() : single.refetch(),
      qc.invalidateQueries({ queryKey: ['comments', task.connectionId, task.key] }),
      qc.invalidateQueries({ queryKey: ['description-html', task.connectionId, task.key] }),
      qc.invalidateQueries({ queryKey: ['children', task.connectionId, task.key] }),
      qc.invalidateQueries({ queryKey: ['worklogs', task.connectionId, task.key] }),
    ]);
  // Only a task of your own list leaves it when reassigned; a sub-task stays under its parent.
  const isSubtask = !!parent || !task.updatedAt;
  const canLog = useCanLogWork(task.connectionId);
  const open = (url: string) => openExternal(url).catch(() => toast.error(t('errors.openLink')));
  const openLabel = provider ? t('tasks.openIn', { name: provider.appName }) : t('tasks.openSource');
  const subtasks = task.subtasks ?? [];
  const done = subtasks.filter((s) => s.statusCategory === 'done').length;

  return (
    <div className="absolute inset-0 z-20 flex flex-col">
      <AppHeader
        leading={
          <IconButton label={t('ui.back')} onClick={closeTask}>
            <ArrowLeft />
          </IconButton>
        }
        title={
          <span className="flex min-w-0 items-center gap-2">
            {provider && <ProviderLogo provider={provider} size="sm" />}
            <span className="truncate font-mono text-md">{task.key}</span>
          </span>
        }
        actions={
          <>
            <Menu>
              <MenuTrigger render={<IconButton label={t('tasks.more')} />}>
                <MoreHorizontal />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<ArrowUpRight />} onClick={() => { markForRefresh(task.connectionId, task.key); open(task.url); }}>
                  {openLabel}
                </MenuItem>
                <MenuItem icon={<Link2 />} onClick={() => copyTaskLink(task.url, t('tasks.linkCopied'))}>
                  {t('tasks.copyLink')}
                </MenuItem>
                <MenuItem icon={<Hash />} onClick={() => copyTaskLink(task.key, t('tasks.idCopied'))}>
                  {t('tasks.copyId')}
                </MenuItem>
              </MenuContent>
            </Menu>
            {/* Straight back to the list, however many pages deep (Back steps one at a time). */}
            <IconButton label={t('detail.home')} onClick={() => go({ name: 'tasks' })}>
              <House />
            </IconButton>
          </>
        }
      />
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-5 px-4 py-4">
          <div className="flex flex-col gap-2">
            {/* A breadcrumb like the source tool's: project / parent / this task, each key with its type icon. The parent opens on click. */}
            <nav aria-label={t('detail.breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
              {task.project && <span className="min-w-0 truncate">{task.project}</span>}
              {parentTask && (
                <>
                  {task.project && <span aria-hidden>/</span>}
                  <button
                    type="button"
                    onClick={() => goTo(parentTask)}
                    title={parentTask.title}
                    aria-label={t('detail.openParent', { key: parentTask.key, title: parentTask.title })}
                    className="inline-flex shrink-0 items-center gap-1 text-ink-2 transition-colors hover:text-ink hover:underline underline-offset-2"
                  >
                    <TypeIcon type={parentTask.type} />
                    {parentTask.key}
                  </button>
                </>
              )}
              {(task.project || parentTask) && <span aria-hidden>/</span>}
              <span className="inline-flex shrink-0 items-center gap-1 text-ink-2" title={task.type}>
                <TypeIcon type={task.type} />
                {task.key}
              </span>
            </nav>
            <h2 data-selectable className="font-display text-xl leading-snug font-semibold text-ink">
              {task.title}
            </h2>
            {blockers.length > 0 && (
              // A blocker is the first thing to know about a task, so it sits right under the title.
              <div className="flex flex-wrap items-center gap-1.5 rounded-sm bg-error-wash px-2.5 py-2 text-sm text-error">
                <Ban className="size-3.5 shrink-0" aria-hidden />
                <span className="font-medium">{t('detail.blockedBy')}</span>
                {blockers.map((b) => (
                  <button key={b.key} type="button" onClick={() => goTo(b)} title={b.title} className="font-mono text-xs underline underline-offset-2">
                    {b.key}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadingTask ? (
            <DetailSkeleton />
          ) : (
            <div className="fade-in flex flex-col gap-5">
          {/* The same controls as on the card, laid out as labelled fields. */}
          <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 text-md">
            {task.type && (
              <Field label={t('detail.type')}>
                <span className="inline-flex items-center gap-1.5">
                  <TypeIcon type={task.type} />
                  {task.type}
                </span>
              </Field>
            )}
            <Field label={t('detail.status')}>
              <StatusMenu
                connectionId={task.connectionId}
                taskKey={task.key}
                status={task.status}
                category={task.statusCategory}
                url={task.url}
                onOpen={open}
                className="mx-0"
              />
            </Field>
            <Field label={t('detail.assignee')}>
              <AssigneeMenu
                connectionId={task.connectionId}
                taskKey={task.key}
                assignee={task.assignee}
                leavesListWhenReassigned={!isSubtask}
                className="mx-0"
              />
            </Field>
            {task.priority && (
              <Field label={t('detail.priority')}>
                <Priority level={task.priorityLevel} label={task.priority} />
              </Field>
            )}
            {(canLog || !!task.loggedSeconds || !!task.estimateSeconds) && (
              <Field label={t('detail.time')}>
                <LogWork connectionId={task.connectionId} taskKey={task.key} logged={task.loggedSeconds} estimate={task.estimateSeconds} className="mx-0">
                  <TimeTracking logged={task.loggedSeconds} estimate={task.estimateSeconds} empty={canLog ? t('tasks.addTime') : undefined} />
                </LogWork>
              </Field>
            )}
            {task.storyPoints != null && (
              <Field label={t('detail.points')}>
                <span className="num">{task.storyPoints}</span>
              </Field>
            )}
            {subtasks.length > 0 && (
              <Field label={t('tasks.subtasks')}>
                <span className="num">{t('detail.subtasksDone', { done, total: subtasks.length })}</span>
              </Field>
            )}
            {task.updatedAt && (
              <Field label={t('detail.updatedLabel')}>
                <span className="num" title={new Date(task.updatedAt).toLocaleString()}>
                  {timeAgo(task.updatedAt)}
                </span>
              </Field>
            )}
            {task.sprint && (
              <Field label={t('detail.sprint')}>
                <span className="truncate" title={task.sprint}>
                  {task.sprint}
                </span>
              </Field>
            )}
          </dl>

          {/* The source's own rendering (tables, panels, smart links) when it has one; our plain version only as a fallback. */}
          {html.isPending && html.fetchStatus !== 'idle' ? (
            <Section title={t('detail.description')}>
              <div className="flex flex-col gap-2" aria-busy>
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-3/5" />
              </div>
            </Section>
          ) : html.data ? (
            <Section title={t('detail.description')}>
              <SourceHtml html={html.data} base={siteOf(task.url)} connectionId={task.connectionId} onOpen={open} className="fade-in" />
            </Section>
          ) : (
            (task.description || task.descriptionParts) &&
            !html.isSuccess && (
              <Section title={t('detail.description')}>
                <RichText
                  text={task.description}
                  parts={task.descriptionParts}
                  attachments={task.attachments}
                  connectionId={task.connectionId}
                  onOpen={open}
                  className="text-md"
                  lines="line-clamp-6"
                  unfolded
                />
              </Section>
            )
          )}

          <AttachmentImages connectionId={task.connectionId} attachments={task.attachments} exclude={inlineImageIds(task.descriptionParts)} onOpen={open} />

          {subtasks.length > 0 && (
            <Section title={`${t('tasks.subtasks')} · ${done}/${subtasks.length}`}>
              <SubtaskList task={task} provider={provider} onOpen={open} />
            </Section>
          )}

          {hasChildren && (
            <Section
              title={
                children.data
                  ? `${isEpic ? t('detail.epicIssues') : t('tasks.subtasks')} · ${children.data.filter((c) => c.statusCategory === 'done').length}/${children.data.length}`
                  : isEpic
                    ? t('detail.epicIssues')
                    : t('tasks.subtasks')
              }
            >
              {children.isPending && children.fetchStatus !== 'idle' ? (
                <div className="flex flex-col gap-1.5" aria-busy>
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : children.isError ? (
                <FailureNotice error={children.error} url={task.url} onOpen={open} appName={provider?.appName} />
              ) : !children.data?.length ? (
                <p className="text-sm text-muted">{t('detail.epicEmpty')}</p>
              ) : (
                <ul className="fade-in cut flex flex-col overflow-hidden border border-rule bg-paper">
                  {children.data.map((c) => (
                    <RelatedRow key={c.id} task={c} assignee={c.assignee?.name} onClick={() => openTask(c)} />
                  ))}
                </ul>
              )}
            </Section>
          )}

          {task.links && task.links.length > 0 && (
            <Section title={t('detail.links')}>
              <div className="flex flex-col gap-2.5">
                {[...new Set(task.links.map((l) => l.relation))].map((relation) => (
                  <div key={relation} className="flex flex-col gap-1">
                    <span className="text-xs text-muted">{relation}</span>
                    <ul className="cut flex flex-col overflow-hidden border border-rule bg-paper">
                      {task.links!
                        .filter((l) => l.relation === relation)
                        .map((l) => (
                          <RelatedRow key={l.key} task={l} onClick={() => goTo(l)} />
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Comments connectionId={task.connectionId} taskKey={task.key} url={task.url} attachments={task.attachments} onOpen={open} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Same footer as the list: when this was last fetched, and a refresh for the task, its logs and comments. */}
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-rule pr-1.5 pl-3 text-xs text-muted">
        <span className="num">
          {fetching ? t('tasks.refreshing') : board.dataUpdatedAt ? t('tasks.updated', { time: timeAgo(new Date(board.dataUpdatedAt).toISOString()) }) : null}
        </span>
        <IconButton label={t('tasks.refreshShortcut')} onClick={refresh} disabled={!!fetching}>
          {fetching ? <Spinner /> : <RefreshCw />}
        </IconButton>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-display text-sm font-semibold text-ink-2">{title}</h3>
      {children}
    </section>
  );
}

/** The site a task's URL belongs to (relative links and images in source HTML resolve against it). */
const siteOf = (url: string) => url.slice(0, Math.max(0, url.indexOf('/browse/'))) || new URL(url).origin;

/** One related task in a list: status, type, key, title (and who has it). Opens its detail page. */
function RelatedRow({ task: r, assignee, onClick }: { task: RelatedTask; assignee?: string; onClick: () => void }) {
  return (
    <li className="border-b border-rule last:border-b-0">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left text-md transition-colors hover:bg-paper-3"
      >
        {r.statusCategory && <StatusDot category={r.statusCategory} status={r.status ?? ''} />}
        <TypeIcon type={r.type} />
        <span className="shrink-0 font-mono text-xs text-muted">{r.key}</span>
        <span className={cn('min-w-0 flex-1 truncate text-ink', r.statusCategory === 'done' && 'text-muted line-through')} title={r.title}>
          {r.title}
        </span>
        {assignee ? <Avatar name={assignee} /> : r.status && <span className="shrink-0 text-xs text-muted">{r.status}</span>}
      </button>
    </li>
  );
}

/** The page's shape while a task outside your list loads, so nothing jumps when it arrives. */
function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Fragment key={i}>
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-28" />
          </Fragment>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
    </div>
  );
}
