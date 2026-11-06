"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import {
  isSafeUrl,
  type StatusCategory,
  type Transition,
  type TransitionInput,
} from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, FileInput } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { Status, StatusDot } from "@/components/ui/status";
import { toast } from "@/components/ui/toaster";
import { useErrorText } from "@/features/connections/error-text";

import { getTransitions, moveTask } from "../../actions";
import { detailOf, unwrap } from "./unwrap";
import { TransitionForm } from "./transition-form";

type Props = {
  board: string;
  taskKey: string;
  status: string;
  category: StatusCategory;
  url: string;
  app: string;
};

const openSource = (url: string) =>
  isSafeUrl(url) && window.open(url, "_blank", "noopener,noreferrer");

/** The task's status; opening it lists the moves its workflow allows right now. A move can be undone from its toast. */
export function StatusMenu({ board, taskKey, status, category, url, app }: Props) {
  const t = useTranslations("actions");
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formFor, setFormFor] = useState<Transition | null>(null);
  const transitions = useQuery({
    queryKey: ["transitions", board, taskKey],
    queryFn: () => unwrap(getTransitions(board, taskKey)),
    enabled: open,
    staleTime: 0,
  });
  const move = useMutation({
    mutationFn: (v: { transition: Transition; input?: TransitionInput }) =>
      unwrap(moveTask(board, taskKey, v.transition.id, v.input)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", board] });
      void queryClient.invalidateQueries({ queryKey: ["transitions", board, taskKey] });
    },
  });

  /** Back to the status it had, when the workflow allows that without a form. */
  const undo = async () => {
    const back = (await unwrap(getTransitions(board, taskKey)).catch(() => [])).find(
      (tr) =>
        tr.to.name.toLocaleLowerCase() === status.toLocaleLowerCase() &&
        !tr.needsInput &&
        !tr.fields.some((f) => f.required),
    );
    if (!back) return toast.error(t("undoUnavailable", { status, app }));
    run(back, undefined, false);
  };

  const run = (transition: Transition, input?: TransitionInput, undoable = true) =>
    move.mutate(
      { transition, input },
      {
        onSuccess: () => {
          setFormFor(null);
          toast.success(
            t("statusChanged", { key: taskKey, status: transition.to.name }),
            undoable ? { action: { label: t("undo"), onClick: () => void undo() } } : undefined,
          );
        },
        // A form shows its own error; a direct move reports in a toast.
        onError: input
          ? undefined
          : (error) =>
              toast.error(t("statusFailed", { key: taskKey }), {
                description: errorText(detailOf(error), app),
              }),
      },
    );

  return (
    <>
      <BaseMenu.Root onOpenChange={setOpen}>
        <BaseMenu.Trigger className="-mx-2 inline-flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 data-[popup-open]:bg-paper-3">
          <Status category={category} label={status} />
          {move.isPending ? (
            <Spinner className="text-muted" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
          )}
        </BaseMenu.Trigger>
        <MenuContent align="start" className="w-72 max-w-[calc(100vw-24px)]">
          <div className="px-2 pt-1 pb-1.5 text-xs text-muted">{t("moveTo")}</div>
          {transitions.isPending ? (
            <div className="flex h-8 items-center gap-2 px-2 text-md text-muted">
              <Spinner />
              {t("loadingStatuses")}
            </div>
          ) : transitions.isError ? (
            <p className="px-2 py-1 text-sm text-error">
              {errorText(detailOf(transitions.error), app)}
            </p>
          ) : transitions.data.length === 0 ? (
            <p className="px-2 py-1 text-md text-muted">{t("noTransitions")}</p>
          ) : (
            transitions.data.map((tr) => (
              <MenuItem
                key={tr.id}
                icon={<StatusDot category={tr.to.category} status={tr.to.name} />}
                onClick={() => {
                  if (tr.needsInput) openSource(url);
                  else if (tr.fields.length) setFormFor(tr);
                  else run(tr);
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {/* Workflows often name the action ("Send to review"); show it like the source does, with the target status. */}
                  <span className="truncate">
                    {tr.name.trim().toLocaleLowerCase() === tr.to.name.trim().toLocaleLowerCase()
                      ? tr.to.name
                      : `${tr.name}`}
                  </span>
                  {tr.name.trim().toLocaleLowerCase() !== tr.to.name.trim().toLocaleLowerCase() && (
                    <span className="shrink-0 text-xs text-muted">{tr.to.name}</span>
                  )}
                  {tr.needsInput ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                      {t("needsSource", { app })}
                      <ExternalLink className="size-3" aria-hidden />
                    </span>
                  ) : tr.fields.length ? (
                    <FileInput
                      className="ml-auto size-3.5 shrink-0 text-muted"
                      aria-label={t("hasForm")}
                    />
                  ) : null}
                </span>
              </MenuItem>
            ))
          )}
          {(transitions.isError || transitions.data?.some((tr) => tr.needsInput)) && (
            <>
              <MenuSeparator />
              <MenuItem icon={<ExternalLink />} onClick={() => openSource(url)}>
                {t("openToChange", { app })}
              </MenuItem>
            </>
          )}
        </MenuContent>
      </BaseMenu.Root>
      {formFor && (
        <TransitionForm
          taskKey={taskKey}
          transition={formFor}
          pending={move.isPending}
          error={move.isError ? errorText(detailOf(move.error), app) : undefined}
          onCancel={() => {
            setFormFor(null);
            move.reset();
          }}
          onSubmit={(input) => run(formFor, input)}
        />
      )}
    </>
  );
}
