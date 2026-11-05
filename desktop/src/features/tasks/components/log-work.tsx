import { parseDuration, type WorkLog } from '@mytask/core';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { errorText } from '@/lib/errors';
import { FailureNotice } from './failure-notice';
import { duration } from '@/lib/format';
import { localized } from '@/lib/i18n';
import { useBoard } from '../hooks/use-board';
import { useCanLogWork, useLogWork, useWorkLogs } from '../hooks/use-worklog';

const QUICK = ['15m', '30m', '1h', '2h', '4h', '8h'];

/** Today keeps the current time; another day starts at 09:00 local. */
function startedAt(date: Date) {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return now;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9);
}

type Props = {
  connectionId: string;
  taskKey: string;
  logged?: number;
  estimate?: number;
  /** The time shown in the row; becomes the trigger. */
  children: ReactNode;
  className?: string;
};

/** Click the time on a task or sub-task to log work against it. */
export function LogWork({ connectionId, taskKey, logged = 0, estimate, children, className }: Props) {
  const { t } = useTranslation();
  const supported = useCanLogWork(connectionId);
  const appName = useBoard(connectionId).provider?.appName;
  const { log, unlog } = useLogWork(connectionId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);

  if (!supported) return <>{children}</>;

  const seconds = parseDuration(text);
  const invalid = touched && !seconds;

  const close = () => {
    setOpen(false);
    setText('');
    setDate(new Date());
    setComment('');
    setTouched(false);
    log.reset();
  };

  const submit = () => {
    setTouched(true);
    if (!seconds) return;
    const entry = { seconds, started: startedAt(date), comment: comment.trim() || undefined };
    // Stay open until Jira answers: success closes, an error is shown in the panel so nothing typed is lost.
    log.mutate(
      { taskKey, entry },
      {
        onSuccess: (workLogId) => {
          close();
          toast.success(t('tasks.logged', { key: taskKey, time: duration(seconds) }), {
            action: {
              label: t('ui.undo'),
              onClick: () =>
                unlog.mutate(
                  { taskKey, workLogId, seconds },
                  { onError: (error) => toast.error(t('tasks.unlogFailed'), { description: errorText(error, t, appName) }) },
                ),
            },
          });
        },
      },
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else if (!log.isPending) close();
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={t('tasks.logWorkOn', { key: taskKey })}
            className={cn(
              'relative z-10 -mx-1 inline-flex items-center rounded-sm px-1 py-0.5 transition-colors hover:bg-paper-3 data-[popup-open]:bg-paper-3',
              className,
            )}
          />
        }
      >
        {children}
        {/* Marks the time as an action, like the ⌄ on status and assignee. */}
        <Plus className="ml-1 size-3 shrink-0 text-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <PopoverHeader title={t('tasks.logWork')}>
            <span className="font-mono text-xs text-muted">{taskKey}</span>
          </PopoverHeader>

          <Field label={t('tasks.timeSpent')} error={invalid ? t('tasks.durationHint') : undefined}>
            <Input
              value={text}
              onValueChange={setText}
              onBlur={() => text && setTouched(true)}
              placeholder="1h 30m"
              autoFocus
            />
          </Field>
          <div className="-mt-1 flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <Button key={q} type="button" size="sm" variant="ghost" className="px-2 font-mono" onClick={() => setText(q)}>
                {q}
              </Button>
            ))}
          </div>

          <Field label={t('tasks.workDate')}>
            <DatePicker value={date} onChange={setDate} max={new Date()} />
          </Field>
          <Field label={t('tasks.workComment')}>
            <Input value={comment} onValueChange={setComment} placeholder={t('tasks.workCommentPlaceholder')} maxLength={500} />
          </Field>

          {seconds ? (
            <p className="num text-sm text-muted">
              {t('tasks.afterLog', {
                total: duration(logged + seconds),
                estimate: estimate ? ` / ${duration(estimate)}` : '',
              })}
            </p>
          ) : null}

          {log.isError && (
            <p role="alert" className="text-sm text-error">
              {t('tasks.logFailed', { key: taskKey })}: {errorText(log.error, t, appName)}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={log.isPending} onClick={close}>
              {t('ui.cancel')}
            </Button>
            <Button type="submit" size="sm" variant="primary" disabled={!text.trim()} loading={log.isPending}>
              {t('tasks.logIt')}
            </Button>
          </div>
        </form>
        <WorkLogList connectionId={connectionId} taskKey={taskKey} enabled={open} onDeleted={close} />
      </PopoverContent>
    </Popover>
  );
}

const dayFormat = localized((l) => new Intl.DateTimeFormat(l, { day: 'numeric', month: 'short' }));

/** Logs already on the task, newest first; your own can be deleted (with undo). A successful delete closes the popup, like logging does. */
function WorkLogList({
  connectionId,
  taskKey,
  enabled,
  onDeleted,
}: {
  connectionId: string;
  taskKey: string;
  enabled: boolean;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const appName = useBoard(connectionId).provider?.appName;
  const logs = useWorkLogs(connectionId, taskKey, enabled);
  const { log, unlog } = useLogWork(connectionId);

  if (logs.isPending && !logs.isFetching) return null; // provider without a log list
  const deleting = unlog.isPending ? unlog.variables?.workLogId : undefined;
  const total = logs.data?.reduce((n, l) => n + l.seconds, 0) ?? 0;
  // Keep a column for the delete button only when some row has one, so times sit flush right otherwise.
  const deletable = !!logs.data?.some((l) => l.mine);

  const remove = (w: WorkLog) =>
    unlog.mutate(
      { taskKey, workLogId: w.id, seconds: w.seconds },
      {
        onSuccess: () => {
          onDeleted();
          toast.success(t('tasks.logDeleted', { time: duration(w.seconds) }), {
            action: {
              label: t('ui.undo'),
              onClick: () =>
                log.mutate(
                  { taskKey, entry: { seconds: w.seconds, started: new Date(w.started), comment: w.comment } },
                  { onError: (error) => toast.error(t('tasks.logFailed', { key: taskKey }), { description: errorText(error, t, appName) }) },
                ),
            },
          });
        },
        onError: (error) => toast.error(t('tasks.logDeleteFailed'), { description: errorText(error, t, appName) }),
      },
    );

  return (
    <section className="mt-3 flex flex-col gap-1.5 border-t border-rule pt-3">
      {/* The total sits in the same column as each row's time; the spacer matches the delete button. */}
      <div className="flex items-center gap-2">
        <h4 className="flex-1 font-display text-sm font-semibold text-ink-2">{t('tasks.workLogs')}</h4>
        {logs.data && logs.data.length > 0 && (
          <>
            <span className="num text-sm font-semibold text-ink">{duration(total)}</span>
            {deletable && <span className="w-[var(--control-sm)] shrink-0" aria-hidden />}
          </>
        )}
      </div>
      {logs.isPending ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
      ) : logs.isError ? (
        <FailureNotice error={logs.error} appName={appName} />
      ) : logs.data.length === 0 ? (
        <p className="text-sm text-muted">{t('tasks.noWorkLogs')}</p>
      ) : (
        <ul className="flex max-h-44 flex-col overflow-y-auto">
          {logs.data.map((w) => (
            <li key={w.id} className="flex items-center gap-2 py-1">
              <Avatar name={w.author} />
              {/* Name gets the whole first line; date and comment share the second. */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm text-ink" title={w.author}>
                    {w.author ?? t('tasks.unknownAuthor')}
                  </span>
                  {w.mine && <Badge className="shrink-0">{t('tasks.you')}</Badge>}
                </span>
                <span className="truncate text-xs text-muted" title={w.comment}>
                  <span className="num">{dayFormat().format(new Date(w.started))}</span>
                  {w.comment && <> · {w.comment}</>}
                </span>
              </div>
              <span className="num shrink-0 text-sm text-ink-2">{duration(w.seconds)}</span>
              {w.mine ? (
                <IconButton
                  label={t('tasks.deleteLog', { time: duration(w.seconds) })}
                  onClick={() => remove(w)}
                  disabled={unlog.isPending}
                  aria-busy={deleting === w.id || undefined}
                >
                  {deleting === w.id ? <Spinner /> : <Trash2 />}
                </IconButton>
              ) : (
                deletable && <span className="size-[var(--control-sm)] shrink-0" aria-hidden />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
