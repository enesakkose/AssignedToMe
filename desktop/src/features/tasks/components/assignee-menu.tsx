import type { Person } from '@mytask/core';
import { Check, ChevronDown, UserMinus, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from '@/components/ui/popover';
import { SearchField } from '@/components/ui/search-field';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/components/ui/toaster';
import { useDebounced } from '@/hooks/use-debounced';
import { cn } from '@/lib/cn';
import { errorText } from '@/lib/errors';
import { FailureNotice } from './failure-notice';
import { useAssign, useAssignees, useCanAssign, useCurrentUser } from '../hooks/use-assignee';
import { useBoard } from '../hooks/use-board';

type Props = {
  connectionId: string;
  taskKey: string;
  assignee?: Person;
  /** Main list shows only my tasks: assigning away means it leaves the list on the next refresh. */
  leavesListWhenReassigned?: boolean;
  className?: string;
};

/** Who a task is assigned to; click to search people and reassign. Same look on cards and sub-tasks. */
export function AssigneeMenu({ connectionId, taskKey, assignee, leavesListWhenReassigned, className }: Props) {
  const { t } = useTranslation();
  const supported = useCanAssign(connectionId);
  const appName = useBoard(connectionId).provider?.appName;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const me = useCurrentUser(connectionId, supported);
  const people = useAssignees(connectionId, taskKey, debounced, open);
  const assign = useAssign(connectionId);
  const listRef = useRef<HTMLUListElement>(null);

  // Load the next page when the list end is near: on scroll, and also after a page that was too short to scroll
  // (Jira often returns few or no new people per page).
  const loadMoreIfNearEnd = () => {
    const el = listRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 64 && people.hasNextPage && !people.isFetchingNextPage) {
      void people.fetchNextPage();
    }
  };
  useEffect(loadMoreIfNearEnd, [people.data, people.isFetchingNextPage]);

  const label = (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-sm">
      <Avatar name={assignee?.name} />
      <span className={cn('truncate', assignee ? 'text-ink-2' : 'text-muted')}>{assignee?.name ?? t('tasks.unassigned')}</span>
    </span>
  );
  if (!supported) return label;

  const pick = (person: Person | null, undo = true) => {
    setOpen(false);
    setQuery('');
    const previous = assignee ?? null;
    assign.mutate(
      { taskKey, person },
      {
        onSuccess: () => {
          const leaves = leavesListWhenReassigned && person?.id !== me.data?.id;
          toast.success(
            person ? t('tasks.assignedTo', { key: taskKey, name: person.name }) : t('tasks.unassignedTask', { key: taskKey }),
            {
              description: leaves ? t('tasks.leavesList') : undefined,
              action: undo ? { label: t('ui.undo'), onClick: () => pick(previous, false) } : undefined,
            },
          );
        },
        onError: (error) => toast.error(t('tasks.assignFailed', { key: taskKey }), { description: errorText(error, t, appName) }),
      },
    );
  };

  const option = (key: string, icon: ReactNode, text: ReactNode, onClick: () => void, selected = false) => (
    <li key={key}>
      <button
        type="button"
        onClick={onClick}
        className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-md hover:bg-paper-3 focus-visible:outline-offset-[-2px]"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{text}</span>
        {selected && <Check className="size-3.5 shrink-0 text-ink-2" aria-hidden />}
      </button>
    </li>
  );

  const showMe = me.data && me.data.id !== assignee?.id && !query.trim();
  // A person can show up on two pages if the list changes between requests; keep the first.
  const seen = new Set<string>();
  const results = (people.data?.pages.flatMap((page) => page.people) ?? []).filter(
    (p) => !(showMe && p.id === me.data?.id) && !seen.has(p.id) && !!seen.add(p.id),
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t('tasks.changeAssignee', { name: assignee?.name ?? t('tasks.unassigned') })}
            className={cn(
              'relative z-10 -mx-1 inline-flex min-w-0 items-center gap-0.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-paper-3 data-[popup-open]:bg-paper-3',
              className,
            )}
          />
        }
      >
        {label}
        {assign.isPending ? <Spinner className="size-3 text-muted" /> : <ChevronDown className="size-3 shrink-0 text-muted" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5">
        <PopoverHeader title={t('tasks.searchPeople')} className="px-1.5 pt-1" />
        <SearchField value={query} onValueChange={setQuery} label={t('tasks.searchPeople')} autoFocus className="mt-2" />
        <ul ref={listRef} className="mt-1.5 flex max-h-60 flex-col overflow-y-auto" onScroll={loadMoreIfNearEnd}>
          {showMe && option('me', <Avatar name={me.data!.name} />, t('tasks.assignToMe'), () => pick(me.data!))}
          {assignee &&
            !query.trim() &&
            option('none', <UserMinus className="size-4 shrink-0 text-muted" aria-hidden />, t('tasks.unassign'), () => pick(null))}
          {(showMe || (assignee && !query.trim())) && <li aria-hidden className="my-1 h-px bg-rule" />}
          {people.isPending ? (
            <li className="flex flex-col gap-1.5 px-2 py-1">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </li>
          ) : people.isError ? (
            <li className="px-2 py-1.5">
              <FailureNotice error={people.error} appName={appName} />
            </li>
          ) : results.length === 0 ? (
            <li className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
              <UserRound className="size-3.5" aria-hidden />
              {t('tasks.noPeople')}
            </li>
          ) : (
            results.map((p) => option(p.id, <Avatar name={p.name} />, p.name, () => pick(p), p.id === assignee?.id))
          )}
          {!query.trim() && people.isSuccess && !people.hasNextPage && results.length > 0 && (
            <li className="px-2 py-1.5 text-xs text-muted">{t('tasks.typeToFindMore')}</li>
          )}
          {people.isFetchingNextPage && (
            <li className="flex h-8 items-center justify-center" aria-label={t('tasks.loadingMore')}>
              <Spinner className="size-3.5 text-muted" />
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
