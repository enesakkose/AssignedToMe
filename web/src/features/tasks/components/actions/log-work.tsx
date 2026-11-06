"use client";

import { parseDuration } from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toaster";
import { useErrorText } from "@/features/connections/error-text";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/format";

import { deleteWorkLog, getWorkLogs, logWork } from "../../actions";
import { detailOf, unwrap } from "./unwrap";

const QUICK = ["15m", "30m", "1h", "2h", "4h", "8h"];
const DAYS = 7;

/** Today keeps the current time; an earlier day starts at 09:00 local, as on desktop. */
function startedAt(daysAgo: number) {
  const now = new Date();
  if (daysAgo === 0) return now;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 9);
}

/** The time on a task opens this: log work against it, and see (or remove) what is already logged. */
export function LogWork({
  board,
  taskKey,
  app,
  children,
}: {
  board: string;
  taskKey: string;
  app: string;
  children: ReactNode;
}) {
  const t = useTranslations("actions");
  const locale = useLocale();
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [daysAgo, setDaysAgo] = useState(0);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState(false);
  const logs = useQuery({
    queryKey: ["worklogs", board, taskKey],
    queryFn: () => unwrap(getWorkLogs(board, taskKey)),
    enabled: open,
    staleTime: 0,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["tasks", board] });
    void queryClient.invalidateQueries({ queryKey: ["worklogs", board, taskKey] });
  };
  const log = useMutation({
    mutationFn: (entry: { seconds: number; started: string; comment?: string }) =>
      unwrap(logWork(board, taskKey, entry)),
    onSettled: refresh,
  });
  const unlog = useMutation({
    mutationFn: (id: string) => unwrap(deleteWorkLog(board, taskKey, id)),
    onSettled: refresh,
  });

  const seconds = parseDuration(text);
  const invalid = touched && !seconds;
  const reset = () => {
    setText("");
    setDaysAgo(0);
    setComment("");
    setTouched(false);
    log.reset();
  };
  const dayLabel = (n: number) =>
    n === 0
      ? t("today")
      : n === 1
        ? t("yesterday")
        : new Intl.DateTimeFormat(locale, {
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(startedAt(n));

  const submit = () => {
    setTouched(true);
    if (!seconds) return;
    // Stays open until the source answers; an error shows in the panel so nothing typed is lost.
    log.mutate(
      { seconds, started: startedAt(daysAgo).toISOString(), comment: comment.trim() || undefined },
      {
        onSuccess: (id) => {
          setOpen(false);
          reset();
          toast.success(t("logged", { key: taskKey, time: formatDuration(seconds) }), {
            action: {
              label: t("undo"),
              onClick: () =>
                unlog.mutate(id, {
                  onError: (e) =>
                    toast.error(t("unlogFailed"), { description: errorText(detailOf(e), app) }),
                }),
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
        else if (!log.isPending) {
          setOpen(false);
          reset();
        }
      }}
    >
      <PopoverTrigger
        aria-label={t("logWorkOn", { key: taskKey })}
        className="-mx-2 inline-flex items-center rounded-full px-2 py-0.5 transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 data-[popup-open]:bg-paper-3"
      >
        {children}
        <Plus className="ml-1 size-3.5 shrink-0 text-muted" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <PopoverHeader title={t("logWork")} closeLabel={t("close")}>
            <span className="font-mono text-xs text-muted">{taskKey}</span>
          </PopoverHeader>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">{t("timeSpent")}</span>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={() => text && setTouched(true)}
              placeholder="1h 30m"
              aria-invalid={invalid}
              autoFocus
            />
            {invalid && <span className="text-sm text-error">{t("durationHint")}</span>}
          </label>
          <div className="-mt-1 flex flex-wrap gap-1">
            {QUICK.map((q) => (
              <Button
                key={q}
                type="button"
                size="sm"
                variant={text === q ? "secondary" : "ghost"}
                className="px-2.5 font-mono text-xs"
                onClick={() => setText(q)}
              >
                {q}
              </Button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">{t("day")}</span>
            {/* The last week, which is when time gets logged; no future days. */}
            <select
              value={daysAgo}
              onChange={(e) => setDaysAgo(Number(e.target.value))}
              className="h-[var(--control-md)] w-full appearance-none rounded-control border border-edge bg-paper px-4 text-md text-ink"
            >
              {Array.from({ length: DAYS }, (_, n) => (
                <option key={n} value={n}>
                  {dayLabel(n)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-2">
              {t("optional", { name: t("comment") })}
            </span>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
          </label>
          {log.isError && (
            <p role="alert" className="text-sm text-error">
              {errorText(detailOf(log.error), app)}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={log.isPending}>
            {log.isPending && <Spinner />}
            {t("logWork")}
          </Button>
        </form>

        <div className="-mx-3 mt-3 border-t border-rule px-3 pt-3">
          <p className="pb-2 text-xs font-medium text-muted">{t("workLog")}</p>
          {logs.isPending ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : logs.isError ? (
            <p className="text-sm text-error">{errorText(detailOf(logs.error), app)}</p>
          ) : logs.data.length === 0 ? (
            <p className="text-sm text-muted">{t("noWorkLog")}</p>
          ) : (
            <ul className="flex max-h-48 flex-col overflow-y-auto">
              {logs.data.map((w) => (
                <li key={w.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="num w-14 shrink-0 font-medium text-ink">
                    {formatDuration(w.seconds)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted" title={w.comment}>
                    {[
                      w.mine ? t("you") : w.author,
                      new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(
                        new Date(w.started),
                      ),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    {w.comment ? ` — ${w.comment}` : ""}
                  </span>
                  {w.mine && (
                    <IconButton
                      label={t("deleteLog")}
                      className={cn("size-7 shrink-0", unlog.isPending && "opacity-50")}
                      onClick={() =>
                        unlog.mutate(w.id, {
                          onSuccess: () => toast.success(t("removedLog")),
                          onError: (e) =>
                            toast.error(t("unlogFailed"), {
                              description: errorText(detailOf(e), app),
                            }),
                        })
                      }
                    >
                      <Trash2 />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
