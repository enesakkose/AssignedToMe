import type { Provider, Subtask, Task } from '@mytask/core';
import { ContextMenu } from '@base-ui/react/context-menu';
import { ArrowRight, ArrowUpRight, ChevronDown, Clock3, Gauge, Hash, IterationCw, Link2, ListTree } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { floatingPanelClass, MenuItem } from '@/components/ui/menu';
import { ProviderLogo } from '@/components/ui/provider-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { Priority, StatusDot } from '@/components/ui/status';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { duration, timeAgo } from '@/lib/format';
import { useCurrentUser } from '../hooks/use-assignee';
import { useCanLogWork } from '../hooks/use-worklog';
import { AssigneeMenu } from './assignee-menu';
import { markForRefresh } from '@/lib/query';
import { useNav } from '@/stores/nav';
import { LogWork } from './log-work';
import { StatusMenu } from './status-menu';

/** Opens a task in its source and marks its board to refetch on return, so a change made there shows up here. */
function openInSource(connectionId: string, taskKey: string, url: string, onOpen: (url: string) => void) {
  markForRefresh(connectionId, taskKey);
  onOpen(url);
}

/** Copies text (a task's URL or id) to the clipboard, with a toast to confirm. */
export function copyTaskLink(text: string, done: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(done));
}

/** Right-click a task to open it in its source, copy its link, or copy its id. Wraps the row so the menu appears at the cursor. */
function TaskMenu({ url, taskKey, openLabel, onOpenSource, className, children }: { url: string; taskKey: string; openLabel: string; onOpenSource: () => void; className?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div className={className} />}>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className="z-50">
          <ContextMenu.Popup data-floating className={cn(floatingPanelClass, 'min-w-44')}>
            <MenuItem icon={<ArrowUpRight />} onClick={onOpenSource}>
              {openLabel}
            </MenuItem>
            <MenuItem icon={<Link2 />} onClick={() => copyTaskLink(url, t('tasks.linkCopied'))}>
              {t('tasks.copyLink')}
            </MenuItem>
            <MenuItem icon={<Hash />} onClick={() => copyTaskLink(taskKey, t('tasks.idCopied'))}>
              {t('tasks.copyId')}
            </MenuItem>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

type TaskRowProps = {
  task: Task;
  provider?: Provider;
  /** Opens a task or sub-task link in the browser. */
  onOpen: (url: string) => void;
};

export function TaskRow({ task, provider, onOpen }: TaskRowProps) {
  const { t } = useTranslation();
  const openTask = useNav((s) => s.openTask);
  const [expanded, setExpanded] = useState(false);
  const subtasksId = `task-${task.id}-subtasks`;
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.statusCategory === 'done').length;
  const canLog = useCanLogWork(task.connectionId);
  // Boolean on purpose: a bare 0 here would be rendered by React.
  const hasPlanning = canLog || task.storyPoints != null || !!task.estimateSeconds || !!task.loggedSeconds || subtasks.length > 0;

  const openLabel = provider ? t('tasks.openIn', { name: provider.appName }) : t('tasks.openSource');
  const content = (
    <>
      <span className="flex items-center gap-2 text-sm text-muted">
        <TaskKey taskKey={task.key} label={openLabel} onOpen={() => openInSource(task.connectionId, task.key, task.url, onOpen)} className="max-w-36 text-ink-2" />
        {task.sprint && (
          <span className="inline-flex min-w-0 shrink items-center gap-1 text-xs text-ink-2" title={task.sprint}>
            <IterationCw className="size-3 shrink-0 text-muted" aria-hidden />
            <span className="truncate">{task.sprint}</span>
          </span>
        )}
        {task.type && <Badge className="max-w-24">{task.type}</Badge>}
        {/* Worth seeing from the list: something unfinished is blocking this task. */}
        {task.links?.some((l) => l.blocksThis && l.statusCategory !== 'done') && <Badge tone="error">{t('tasks.blocked')}</Badge>}
        <span className="num ml-auto shrink-0 text-xs">{timeAgo(task.updatedAt)}</span>
      </span>
      {/* Stretched over the whole card: clicking anywhere opens the task's detail page. The card's own controls sit above it (z-10). */}
      <button
        type="button"
        onClick={() => openTask(task)}
        className="line-clamp-2 text-left font-display text-title leading-snug font-semibold text-ink focus-visible:outline-offset-[-2px] after:absolute after:inset-0"
      >
        {task.title}
      </button>
      <span className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', !hasPlanning && 'pr-28')}>
        <StatusMenu
          connectionId={task.connectionId}
          taskKey={task.key}
          status={task.status}
          category={task.statusCategory}
          url={task.url}
          onOpen={onOpen}
        />
        {/* Medium is the default on almost every task; only an unusual priority is worth the space. */}
        {task.priority && task.priorityLevel !== 3 && <Priority level={task.priorityLevel} label={task.priority} />}
        <AssigneeMenu connectionId={task.connectionId} taskKey={task.key} assignee={task.assignee} leavesListWhenReassigned />
      </span>
      {hasPlanning && (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pr-28 text-sm text-ink-2">
          {task.storyPoints != null && (
            <Meta icon={<Gauge />}>
              <span className="num">{t('tasks.points', { count: task.storyPoints })}</span>
            </Meta>
          )}
          <LogWork connectionId={task.connectionId} taskKey={task.key} logged={task.loggedSeconds} estimate={task.estimateSeconds}>
            <TimeTracking logged={task.loggedSeconds} estimate={task.estimateSeconds} empty={canLog ? t('tasks.addTime') : undefined} />
          </LogWork>
          {subtasks.length > 0 && (
            // The sub-task count is also the toggle that opens them under the card.
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={subtasksId}
              aria-label={`${t('tasks.subtasksDone', { done: doneSubtasks, total: subtasks.length })}. ${expanded ? t('tasks.hideSubtasks') : t('tasks.showSubtasks')}`}
              title={expanded ? t('tasks.hideSubtasks') : t('tasks.showSubtasks')}
              onClick={() => setExpanded((v) => !v)}
              className="relative z-10 -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:bg-paper-3 aria-expanded:bg-paper-3"
            >
              <ListTree className="size-3 shrink-0 text-muted" aria-hidden />
              <span className="num">
                {doneSubtasks}/{subtasks.length}
              </span>
              <ChevronDown
                className={cn('size-3 shrink-0 text-muted transition-transform duration-[var(--dur-short)] ease-out', expanded && 'rotate-180')}
                aria-hidden
              />
            </button>
          )}
        </span>
      )}
    </>
  );

  return (
    <li className="border-b border-rule">
      <TaskMenu
        url={task.url}
        taskKey={task.key}
        openLabel={openLabel}
        onOpenSource={() => openInSource(task.connectionId, task.key, task.url, onOpen)}
        className="relative flex items-start gap-2.5 px-3 py-3"
      >
        <div className="mt-px w-4 shrink-0">{provider && <ProviderLogo provider={provider} size="sm" />}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">{content}</div>
        <div className="relative z-10 -mt-1 -mr-1 flex shrink-0 items-center">
          {/* The same as clicking the card: says out loud that the card leads to a detail page. */}
          <IconButton label={t('tasks.viewDetails')} onClick={() => openTask(task)}>
            <ArrowRight />
          </IconButton>
        </div>
        {/* Text, not just ↗, so it reads as "open in the source" at a glance; the full name is in the label. */}
        <Button
          size="sm"
          variant="ghost"
          aria-label={openLabel}
          onClick={() => openInSource(task.connectionId, task.key, task.url, onOpen)}
          className="absolute right-2 bottom-2 z-10 gap-1 px-2"
        >
          {openLabel}
          <ArrowUpRight className="size-3.5" />
        </Button>
      </TaskMenu>
      {expanded && subtasks.length > 0 && (
        <div id={subtasksId} className="bg-paper-2 py-3 pr-3 pl-9.5">
          <SubtaskList task={task} provider={provider} onOpen={onOpen} />
        </div>
      )}
    </li>
  );
}

/** A task's sub-tasks: yours first, then in progress before to do; done always last. */
export function SubtaskList({ task, provider, onOpen }: { task: Task; provider?: Provider; onOpen: (url: string) => void }) {
  const { t } = useTranslation();
  const subtasks = task.subtasks ?? [];
  const me = useCurrentUser(task.connectionId, subtasks.length > 0).data?.id;
  // sort is stable, so Jira's order breaks ties.
  const rank = (s: Subtask) =>
    (s.statusCategory === 'done' ? 4 : 0) + (me && s.assignee?.id === me ? 0 : 2) + (s.statusCategory === 'in_progress' ? 0 : 1);
  return (
    <ul className="cut flex flex-col overflow-hidden border border-rule bg-paper">
      {[...subtasks]
        .sort((a, b) => rank(a) - rank(b))
        .map((s) => (
          <SubtaskRow
            key={s.id}
            subtask={s}
            mine={!!me && s.assignee?.id === me}
            connectionId={task.connectionId}
            openLabel={provider ? t('tasks.openIn', { name: provider.appName }) : t('tasks.openSource')}
            onOpen={onOpen}
          />
        ))}
    </ul>
  );
}

type SubtaskRowProps = { subtask: Subtask; mine: boolean; connectionId: string; openLabel: string; onOpen: (url: string) => void };

/** A sub-task as a task, for its detail page. It has no update time of its own, so that stays empty. */
export const subtaskAsTask = (s: Subtask, connectionId: string): Task => ({ ...s, connectionId, updatedAt: '' });

function SubtaskRow({ subtask: s, mine, connectionId, openLabel, onOpen }: SubtaskRowProps) {
  const { t } = useTranslation();
  const canLog = useCanLogWork(connectionId);
  const openTask = useNav((n) => n.openTask);
  const details = () => openTask(subtaskAsTask(s, connectionId));

  return (
    <li className="border-b border-rule last:border-b-0">
      {/* Your own sub-tasks carry an accent edge; the rest stay at full contrast so they remain readable. */}
      <TaskMenu
        url={s.url}
        taskKey={s.key}
        openLabel={openLabel}
        onOpenSource={() => openInSource(connectionId, s.key, s.url, onOpen)}
        className={cn('relative flex flex-col gap-1.5 px-2.5 py-2.5', mine && 'bg-paper-2 shadow-[inset_2px_0_0_var(--color-progress)]')}
      >
        <span className="flex min-w-0 items-center gap-2">
          <StatusDot category={s.statusCategory} status={s.status} />
          <TaskKey taskKey={s.key} label={`${s.key}: ${openLabel}`} onOpen={() => openInSource(connectionId, s.key, s.url, onOpen)} className="text-muted" />
          <IconButton label={t('tasks.viewDetails')} onClick={details} className="relative z-10 -my-1 -mr-1.5 ml-auto">
            <ArrowRight />
          </IconButton>
        </span>
        {/* Its own line, up to two, so the title reads whole. Stretched over the row: clicking anywhere opens the detail page. */}
        <button
          type="button"
          onClick={details}
          className={cn(
            'line-clamp-2 text-left text-md text-ink focus-visible:outline-offset-[-2px] after:absolute after:inset-0',
            s.statusCategory === 'done' && 'text-muted line-through',
          )}
        >
          {s.title}
        </button>
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          <AssigneeMenu connectionId={connectionId} taskKey={s.key} assignee={s.assignee} />
          <StatusMenu
            connectionId={connectionId}
            taskKey={s.key}
            status={s.status}
            category={s.statusCategory}
            url={s.url}
            onOpen={onOpen}
          />
        </span>
        <span className="flex min-w-0 items-center gap-2 text-sm text-ink-2">
          <LogWork connectionId={connectionId} taskKey={s.key} logged={s.loggedSeconds} estimate={s.estimateSeconds}>
            <TimeTracking logged={s.loggedSeconds} estimate={s.estimateSeconds} empty={canLog ? t('tasks.addTime') : undefined} />
          </LogWork>
          <Button
            size="sm"
            variant="ghost"
            aria-label={`${s.key}: ${openLabel}`}
            onClick={() => openInSource(connectionId, s.key, s.url, onOpen)}
            className="relative z-10 -my-1 -mr-1.5 ml-auto h-6 gap-1 px-2"
          >
            {openLabel}
            <ArrowUpRight className="size-3.5" />
          </Button>
        </span>
      </TaskMenu>
    </li>
  );
}

/** The task key; opens the task in its source, like a link. Sits above the card's stretched toggle. */
function TaskKey({ taskKey, label, onOpen, className }: { taskKey: string; label: string; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={cn('relative z-10 shrink-0 truncate font-mono text-xs underline-offset-2 hover:text-ink hover:underline', className)}
    >
      {taskKey}
    </button>
  );
}

function Meta({ icon, label, children }: { icon: ReactNode; label?: string; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1 [&>svg]:size-3 [&>svg]:shrink-0 [&>svg]:text-muted" title={label} aria-label={label}>
      {icon}
      {children}
    </span>
  );
}

/** Everyone's logged time against the original estimate, with a small meter when an estimate exists. Who logged what is in the log popup. */
export function TimeTracking({ logged = 0, estimate, compact, empty }: { logged?: number; estimate?: number; compact?: boolean; empty?: string }) {
  const { t } = useTranslation();
  if (!logged && !estimate) {
    // Nothing tracked yet: show an inviting label when time can be logged here.
    return empty ? (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Clock3 className="size-3 shrink-0" aria-hidden />
        {empty}
      </span>
    ) : null;
  }
  const over = !!estimate && logged > estimate;
  const label = estimate
    ? t('tasks.timeOfEstimate', { logged: duration(logged), estimate: duration(estimate) })
    : t('tasks.timeLogged', { logged: duration(logged) });

  return (
    <span className="inline-flex items-center gap-1.5" aria-label={label} title={label}>
      {!compact && <Clock3 className="size-3 shrink-0 text-muted" aria-hidden />}
      <span className={cn('num', over && 'text-error')} aria-hidden>
        {/* Same shape everywhere: "logged / estimate", or "1h logged" when there is no estimate; nothing logged reads as a dash, not "0m". */}
        {estimate ? (
          <>
            {logged ? duration(logged) : '–'}
            <span className="text-muted"> / {duration(estimate)}</span>
          </>
        ) : (
          label
        )}
      </span>
      {estimate ? (
        <span className={cn('h-1 overflow-hidden rounded-full bg-paper-3', compact ? 'w-6' : 'w-10')} aria-hidden>
          <span
            className={cn('block h-full rounded-full', over ? 'bg-error' : 'bg-progress')}
            style={{ width: `${Math.min(logged / estimate, 1) * 100}%` }}
          />
        </span>
      ) : null}
    </span>
  );
}

export function TaskRowSkeleton() {
  return (
    <li className="flex gap-2.5 border-b border-rule px-3 py-3">
      <Skeleton className="size-4 shrink-0" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-32" />
      </div>
    </li>
  );
}
