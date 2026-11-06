"use client";

import { isSafeUrl, type Task } from "@mytask/core";
import { ArrowUpRight, Gauge, IterationCw, ListTree, UserRound } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { ProviderLogo, type ProviderView } from "@/components/ui/provider-logo";
import { Priority, Status } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatAge } from "@/lib/format";

import { typeTone } from "../lib/type-tone";
import { TimeMeter } from "./time-meter";

const hasUnfinishedBlocker = (task: Task) =>
  task.links?.some((l) => l.blocksThis && l.statusCategory !== "done");

/**
 * One task, laid out exactly like a desktop card: the board's mark in its own column; the key, sprint and type with the
 * age on the right; the title; status, priority and assignee; then points, time and sub-tasks, ending in "Open in …".
 * `href` makes the card select the task (the title's link covers the card); without it the card is a still picture.
 */
export function TaskCard({
  task,
  provider,
  href,
  selected,
}: {
  task: Task;
  provider?: ProviderView;
  href?: string;
  selected?: boolean;
}) {
  const t = useTranslations("queue");
  const locale = useLocale();
  const app = provider?.appName ?? provider?.name ?? "";
  const subtasks = task.subtasks ?? [];
  const done = subtasks.filter((s) => s.statusCategory === "done").length;
  const timed = !!(task.estimateSeconds || task.loggedSeconds);
  const third = task.storyPoints != null || timed || subtasks.length > 0;
  const titleClass =
    "line-clamp-2 font-display text-title leading-snug font-semibold [overflow-wrap:break-word] text-ink";
  const open =
    href && isSafeUrl(task.url) ? (
      <a
        href={task.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "relative z-10 -my-1 -mr-2 ml-auto h-7 gap-1 px-2 text-sm",
        )}
      >
        {t("openIn", { app })}
        <ArrowUpRight aria-hidden />
      </a>
    ) : (
      <span
        aria-hidden
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-my-1 -mr-2 ml-auto h-7 gap-1 px-2 text-sm",
        )}
      >
        {t("openIn", { app })}
        <ArrowUpRight />
      </span>
    );
  return (
    <li className="border-b border-rule">
      <div
        aria-current={selected ? "true" : undefined}
        className={cn(
          "relative flex items-start gap-3 px-4 py-3.5 sm:px-5",
          href &&
            "transition-colors duration-[var(--dur-micro)] hover:bg-paper-2 has-[a:focus-visible]:bg-paper-2",
          "aria-[current=true]:bg-paper-3",
          // The mark's pulled-out bar: the open task has it in the gutter.
          "before:absolute before:top-4 before:left-0 before:h-5 before:w-[3px] before:rounded-r-full before:bg-accent before:opacity-0 aria-[current=true]:before:opacity-100",
        )}
      >
        <span className="mt-0.5 w-4 shrink-0">
          {provider && <ProviderLogo provider={provider} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted">
            <span
              className="max-w-40 shrink-0 truncate font-mono text-xs text-ink-2"
              title={task.key}
            >
              {task.key}
            </span>
            {task.sprint && (
              <span
                className="inline-flex min-w-0 shrink items-center gap-1 text-xs text-ink-2"
                title={task.sprint}
              >
                <IterationCw className="size-3 shrink-0 text-muted" aria-hidden />
                <span className="truncate">{task.sprint}</span>
              </span>
            )}
            {task.type && (
              <Badge tone={typeTone(task.type)} className="max-w-28">
                {task.type}
              </Badge>
            )}
            {hasUnfinishedBlocker(task) && (
              <Badge tone="error" className="shrink-0">
                {t("blocked")}
              </Badge>
            )}
            <time
              dateTime={task.updatedAt}
              className="num ml-auto shrink-0 text-xs whitespace-nowrap"
            >
              {formatAge(task.updatedAt, locale)}
            </time>
          </span>
          {href ? (
            <Link
              href={href}
              scroll={false}
              className={cn(
                titleClass,
                "text-left focus-visible:outline-offset-2 after:absolute after:inset-0",
              )}
            >
              {task.title}
            </Link>
          ) : (
            <span className={titleClass}>{task.title}</span>
          )}
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Status category={task.statusCategory} label={task.status} />
            {task.priority && <Priority level={task.priorityLevel} label={task.priority} />}
            <span className="inline-flex min-w-0 items-center gap-1 text-sm text-ink-2">
              <UserRound className="size-3.5 shrink-0 text-muted" aria-hidden />
              <span className="truncate">{task.assignee?.name ?? t("unassigned")}</span>
            </span>
            {!third && open}
          </span>
          {third && (
            <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              {task.storyPoints != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="size-3.5 text-muted" aria-hidden />
                  <span className="num">{t("points", { count: task.storyPoints })}</span>
                </span>
              )}
              {timed && <TimeMeter logged={task.loggedSeconds} estimate={task.estimateSeconds} />}
              {subtasks.length > 0 && (
                <span
                  className="num inline-flex items-center gap-1.5"
                  title={t("subtasks", { done, total: subtasks.length })}
                >
                  <ListTree className="size-3.5 text-muted" aria-hidden />
                  {done}/{subtasks.length}
                </span>
              )}
              {open}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}
