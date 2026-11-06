"use client";

import { activeFilterCount, emptyFilters, type Provider, type Task } from "@mytask/core";
import { CircleAlert, Inbox, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button-variants";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useErrorText } from "@/features/connections/error-text";
import type { Board } from "@/features/boards/lib/board";

import type { Queue } from "../lib/build-queue";
import { ALL_BOARDS, queueHref, type QueueParams } from "../lib/queue-params";
import type { SourceSearch } from "../lib/use-source-search";
import { TaskCard } from "./task-card";

/**
 * A board whose sign-in has ended: what broke, and what to do about it. Among other boards it is one quiet line above
 * the tasks that did load; on its own page it has the list to itself.
 */
function BoardError({
  board,
  provider,
  alone,
}: {
  board: Board;
  provider?: Provider;
  alone: boolean;
}) {
  const t = useTranslations("queue");
  const title = t("errorTitle", { board: board.name });
  const errorText = useErrorText();
  const app = provider?.appName ?? board.name;
  const description = board.error ? errorText(board.error, app) : t("errorSignedOut", { app });
  if (alone)
    return (
      <ErrorState className="mx-4 mt-6 max-w-xl sm:mx-6" title={title} description={description} />
    );
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 border-b border-rule bg-error-wash px-4 py-2.5 text-sm sm:px-6"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
      <p className="text-ink-2">
        <span className="font-medium text-error">{title}</span> {description}
      </p>
    </div>
  );
}

/** Nothing to list: say why, with the one action that helps. */
function Nothing({ queue, params }: { queue: Queue; params: QueueParams }) {
  const t = useTranslations("queue");
  if (queue.connected === 0)
    return (
      <EmptyState
        icon={<Inbox />}
        title={t("noBoardsTitle")}
        description={t("noBoardsDescription")}
        action={
          <Link href="/app/connect" className={buttonVariants({ variant: "primary", size: "sm" })}>
            <Plus aria-hidden />
            {t("noBoardsAction")}
          </Link>
        }
      />
    );
  if (params.q || activeFilterCount(params.filters) > 0)
    return (
      <EmptyState
        icon={<SearchX />}
        title={t("noResultsTitle")}
        description={t("noResultsDescription")}
        action={
          <Link
            href={queueHref(params, { q: "", filters: emptyFilters(), task: "" })}
            className={buttonVariants({ size: "sm" })}
          >
            {t("clearSearch")}
          </Link>
        }
      />
    );
  if (queue.board)
    return (
      <EmptyState
        icon={<Inbox />}
        title={t("emptyBoardTitle", { board: queue.board.name })}
        description={t("emptyBoardDescription")}
        action={
          <Link
            href={queueHref(params, { board: ALL_BOARDS, task: "" })}
            className={buttonVariants({ size: "sm" })}
          >
            {t("showAll")}
          </Link>
        }
      />
    );
  return (
    <EmptyState icon={<Inbox />} title={t("emptyTitle")} description={t("emptyDescription")} />
  );
}

/** My open tasks across the boards in view, newest first, one card each as on desktop. */
export function TaskList({
  queue,
  params,
  providers,
  loading,
  remote,
}: {
  queue: Queue;
  params: QueueParams;
  providers: Map<string, Provider>;
  /** Boards are still loading for the first time: draw the list's shape, not "nothing here". */
  loading?: boolean;
  /** What the search found in the sources beyond my tasks. */
  remote?: SourceSearch;
}) {
  const t = useTranslations("queue");
  // A board that failed is already explained by its error; "no open tasks" under it would say it twice.
  const showNothing =
    !loading && queue.tasks.length === 0 && !queue.board?.signedOut && !remote?.tasks.length;
  const card = (task: Task) => (
    <TaskCard
      key={`${task.connectionId}:${task.id}`}
      task={task}
      provider={providers.get(task.connectionId)}
      href={queueHref(params, { task: params.task === task.key ? "" : task.key })}
      selected={params.task === task.key}
    />
  );
  return (
    <div className="flex-1">
      {queue.failed.map((b) => (
        <BoardError key={b.id} board={b} provider={providers.get(b.id)} alone={!!queue.board} />
      ))}
      {queue.tasks.length > 0 && <ul aria-label={t("list")}>{queue.tasks.map(card)}</ul>}
      {loading && queue.tasks.length === 0 && (
        <ul aria-busy className="flex flex-col">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex gap-3 border-b border-rule px-4 py-3.5 sm:px-5">
              <Skeleton className="size-4 shrink-0" />
              <span className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-44" />
              </span>
            </li>
          ))}
        </ul>
      )}
      {showNothing && !remote?.pending && <Nothing queue={queue} params={params} />}
      {params.q.trim().length >= 2 && (remote?.pending || !!remote?.tasks.length) && (
        <section aria-label={t("inSource")}>
          <h2 className="flex h-10 items-center gap-2 border-b border-rule px-4 text-sm text-muted sm:px-5">
            {t("inSource")}
            {remote.pending && <Spinner className="size-3.5" />}
          </h2>
          <ul>{remote.tasks.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
