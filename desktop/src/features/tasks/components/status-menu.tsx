import type { StatusCategory, Transition, TransitionInput } from '@mytask/core';
import { ChevronDown, ExternalLink, FileInput } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Spinner } from '@/components/ui/spinner';
import { Status, StatusDot } from '@/components/ui/status';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { errorText } from '@/lib/errors';
import { markForRefresh } from '@/lib/query';
import { FailureNotice } from './failure-notice';
import { useBoard } from '../hooks/use-board';
import { useCanChangeStatus, useChangeStatus, useFindTransitionBack, useTransitions } from '../hooks/use-transitions';
import { TransitionForm } from './transition-form';

type Props = {
  connectionId: string;
  taskKey: string;
  status: string;
  category: StatusCategory;
  url: string;
  onOpen: (url: string) => void;
  className?: string;
};

/** A task's status; clicking it moves the task to any status its workflow allows right now. Same look on cards and sub-tasks. */
export function StatusMenu({ connectionId, taskKey, status, category, url, onOpen, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [formFor, setFormFor] = useState<Transition | null>(null);
  const supported = useCanChangeStatus(connectionId);
  const transitions = useTransitions(connectionId, taskKey, open);
  const change = useChangeStatus(connectionId);
  const findBack = useFindTransitionBack(connectionId);
  const appName = useBoard(connectionId).provider?.appName;

  const label = <Status category={category} label={status} />;
  if (!supported) return label;

  /** Success toast with undo back to the previous status (when the workflow allows it without a form). */
  const announce = (transition: Transition, undoable: boolean) =>
    toast.success(t('tasks.statusChanged', { key: taskKey, status: transition.to.name }), {
      action: undoable
        ? {
            label: t('ui.undo'),
            onClick: async () => {
              const back = await findBack(taskKey, status).catch(() => undefined);
              if (back && !back.fields.some((f) => f.required)) move(back, false);
              else toast.error(t('tasks.undoUnavailable', { status, app: appName }));
            },
          }
        : undefined,
    });

  const move = (transition: Transition, undoable = true, input?: TransitionInput, onDone?: () => void) =>
    change.mutate(
      { taskKey, transition, input },
      {
        onSuccess: () => {
          onDone?.();
          announce(transition, undoable);
        },
        // A form shows its own error; a direct move reports in a toast.
        onError: input
          ? undefined
          : (error) => toast.error(t('tasks.statusChangeFailed', { key: taskKey }), { description: errorText(error, t, appName) }),
      },
    );

  const needsSource = transitions.isError || transitions.data?.some((tr) => tr.needsInput);

  return (
    <>
      <Menu onOpenChange={setOpen}>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label={t('tasks.changeStatus', { status })}
              className={cn(
                'relative z-10 -mx-1 inline-flex min-w-0 items-center gap-0.5 rounded-sm px-1 py-0.5 transition-colors hover:bg-paper-3',
                'data-[popup-open]:bg-paper-3',
                className,
              )}
            />
          }
        >
          {label}
          {change.isPending ? <Spinner className="size-3 text-muted" /> : <ChevronDown className="size-3 shrink-0 text-muted" aria-hidden />}
        </MenuTrigger>
        <MenuContent align="start" className="w-72 max-w-[calc(100vw-24px)]">
          <div className="px-2 pt-1 pb-1.5 text-xs text-muted">{t('tasks.moveTo')}</div>
          {transitions.isPending ? (
            <div className="flex h-7 items-center gap-2 px-2 text-md text-muted">
              <Spinner />
              {t('tasks.loadingStatuses')}
            </div>
          ) : transitions.isError ? (
            <div className="px-2 py-1">
              <FailureNotice error={transitions.error} appName={appName} />
            </div>
          ) : transitions.data.length === 0 ? (
            <div className="px-2 py-1 text-md text-muted">{t('tasks.noTransitions')}</div>
          ) : (
            transitions.data.map((tr) => (
              <MenuItem
                key={tr.id}
                disabled={tr.needsInput}
                icon={<StatusDot category={tr.to.category} status={tr.to.name} />}
                shortcut={
                  tr.needsInput ? (
                    <span className="text-xs text-muted">{t('tasks.needsSource', { app: appName })}</span>
                  ) : tr.fields.length ? (
                    <FileInput className="size-3 shrink-0 text-muted" aria-label={t('tasks.hasForm')} />
                  ) : undefined
                }
                // Transitions with a screen (e.g. "Estimated Budget Effort") open a form first.
                onClick={() => (tr.fields.length ? setFormFor(tr) : move(tr))}
              >
                {/* Workflows often name the action ("Send Code Review"); show it like Jira does, with the target status. */}
                {tr.name.trim().toLocaleLowerCase() === tr.to.name.trim().toLocaleLowerCase() ? (
                  tr.to.name
                ) : (
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate">{tr.name}</span>
                    <span className="shrink-0 text-xs text-muted">→ {tr.to.name}</span>
                  </span>
                )}
              </MenuItem>
            ))
          )}
          {needsSource && (
            <>
              <MenuSeparator />
              <MenuItem icon={<ExternalLink />} onClick={() => { markForRefresh(connectionId, taskKey); onOpen(url); }}>
                {t('tasks.openToChange', { app: appName })}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </Menu>
      {formFor && (
        <TransitionForm
          taskKey={taskKey}
          transition={formFor}
          pending={change.isPending}
          error={change.isError ? errorText(change.error, t, appName) : undefined}
          onCancel={() => {
            setFormFor(null);
            change.reset();
          }}
          onSubmit={(input) => move(formFor, true, input, () => setFormFor(null))}
        />
      )}
    </>
  );
}
