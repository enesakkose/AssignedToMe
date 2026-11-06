"use client";

import { isSafeUrl, type Provider, type Task } from "@mytask/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import { IconButton } from "@/components/ui/button";
import { ProviderLogo } from "@/components/ui/provider-logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Priority, Status, StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { formatAge } from "@/lib/format";

import { getTask } from "../actions";
import { queueHref, type QueueParams } from "../lib/queue-params";
import { unwrap } from "./actions/unwrap";
import { AssigneeMenu } from "./actions/assignee-menu";
import { Comments } from "./actions/comments";
import { LogWork } from "./actions/log-work";
import { StatusMenu } from "./actions/status-menu";
import { Children } from "./children";
import { Description, Images } from "./description";
import { TimeMeter } from "./time-meter";
import { TypeIcon } from "./type-icon";

// Label on the left, value on the right: the two cells of one row of the fields grid (desktop/mobile layout).
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-md">{children}</dd>
    </>
  );
}

function External({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  // Only http(s) links open, and never with access to this page.
  if (!isSafeUrl(href)) return <span className={className}>{children}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function Related({ task }: { task: Task }) {
  const t = useTranslations("detail");
  const subtasks = task.subtasks ?? [];
  return (
    <>
      {subtasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-title">{t("subtasks")}</h3>
          <ul className="cut overflow-hidden border border-rule bg-paper">
            {subtasks.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-rule px-3 py-2.5 last:border-b-0"
              >
                <StatusDot category={s.statusCategory} status={s.status} />
                <span className="shrink-0 font-mono text-xs text-muted">{s.key}</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-md",
                    s.statusCategory === "done" && "text-muted line-through",
                  )}
                >
                  {s.title}
                </span>
                <Avatar name={s.assignee?.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {task.links && task.links.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-title">{t("links")}</h3>
          <ul className="flex flex-col">
            {/* A task can link to the same issue twice (blocks and relates to): the relation keeps each row apart. */}
            {task.links.map((l, i) => (
              <li
                key={`${l.relation}:${l.key}:${i}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-rule py-2 text-md last:border-b-0"
              >
                <span className="text-sm text-muted">{l.relation}</span>
                <External
                  href={l.url}
                  className="inline-flex min-w-0 items-center gap-1.5 hover:underline"
                >
                  <span className="font-mono text-xs text-ink-2">{l.key}</span>
                  <span className="truncate">{l.title}</span>
                </External>
                {l.status && l.statusCategory && (
                  <Status category={l.statusCategory} label={l.status} className="ml-auto" />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** The open task, read in full in a panel beside the list; on a phone it takes the screen and Back returns to the list. */
export function TaskDetail({
  task: root,
  provider,
  params,
}: {
  task: Task;
  provider?: Provider;
  params: QueueParams;
}) {
  const t = useTranslations("detail");
  const locale = useLocale();
  const app = provider?.appName ?? provider?.name ?? "";
  const close = queueHref(params, { task: "" });
  // Drilling into a parent or related task keeps you in the app: its key is pushed here and loaded from the same board.
  const canDrillIn = !!provider?.getTask;
  const [stack, setStack] = useState<string[]>([]);
  const board = root.connectionId;
  const topKey = stack.at(-1);
  const drilled = useQuery({
    queryKey: ["task", board, topKey],
    queryFn: () => unwrap(getTask(board, topKey!)),
    enabled: !!topKey && canDrillIn,
    staleTime: 60_000,
  });
  const task = topKey ? drilled.data : root;
  const openTask = (key: string) => setStack((s) => [...s, key]);
  const back = () => setStack((s) => s.slice(0, -1));

  return (
    <article aria-label={t("pane")} key={root.key} className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-rule px-4 sm:px-6">
        {stack.length > 0 ? (
          // Back through the tasks drilled into (parent, related), one at a time.
          <IconButton label={t("back")} onClick={back} className="-ml-1.5">
            <ArrowLeft aria-hidden />
          </IconButton>
        ) : (
          <Link
            href={close}
            scroll={false}
            aria-label={t("back")}
            title={t("back")}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "-ml-1.5 lg:hidden")}
          >
            <ArrowLeft aria-hidden />
          </Link>
        )}
        {provider && <ProviderLogo provider={provider} />}
        <span className="inline-flex min-w-0 items-center gap-1.5 text-ink-2" title={task?.type}>
          <TypeIcon type={task?.type} />
          <span className="truncate font-mono text-xs">{task?.key ?? topKey}</span>
        </span>
        <div className="ml-auto flex items-center gap-1">
          {task && isSafeUrl(task.url) && (
            <External
              href={task.url}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {t("open", { app })}
              <ExternalLink aria-hidden />
            </External>
          )}
          <Link
            href={close}
            scroll={false}
            aria-label={t("close")}
            title={t("close")}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "hidden lg:inline-flex",
            )}
          >
            <X aria-hidden />
          </Link>
        </div>
      </header>

      {!task ? (
        <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6" aria-busy>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-6 p-4 sm:p-6">
            <div className="flex flex-col gap-2">
              {/* A breadcrumb like the source tool's: project / parent / this task, each key with its type icon. */}
              <nav
                aria-label={t("breadcrumb")}
                className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted"
              >
                {task.project && <span className="min-w-0 truncate">{task.project}</span>}
                {task.parent && (
                  <>
                    {task.project && <span aria-hidden>/</span>}
                    {canDrillIn ? (
                      <button
                        type="button"
                        onClick={() => openTask(task.parent!.key)}
                        className="inline-flex shrink-0 items-center gap-1 text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                      >
                        <TypeIcon type={task.parent.type} />
                        {task.parent.key}
                      </button>
                    ) : (
                      <External
                        href={task.parent.url}
                        className="inline-flex shrink-0 items-center gap-1 text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                      >
                        <TypeIcon type={task.parent.type} />
                        {task.parent.key}
                      </External>
                    )}
                  </>
                )}
                {(task.project || task.parent) && <span aria-hidden>/</span>}
                <span
                  className="inline-flex shrink-0 items-center gap-1 text-ink-2"
                  title={task.type}
                >
                  <TypeIcon type={task.type} />
                  {task.key}
                </span>
              </nav>
              <h2 className="text-2xl leading-tight">{task.title}</h2>
            </div>

            <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-y border-rule py-5">
              {task.type && (
                <Field label={t("type")}>
                  <span className="inline-flex items-center gap-1.5">
                    <TypeIcon type={task.type} />
                    <span className="truncate">{task.type}</span>
                  </span>
                </Field>
              )}
              <Field label={t("status")}>
                {provider?.getTransitions && provider.transition ? (
                  <StatusMenu
                    board={task.connectionId}
                    taskKey={task.key}
                    status={task.status}
                    category={task.statusCategory}
                    url={task.url}
                    app={app}
                  />
                ) : (
                  <Status category={task.statusCategory} label={task.status} />
                )}
              </Field>
              <Field label={t("assignee")}>
                {provider?.assign && provider.searchAssignees ? (
                  <AssigneeMenu
                    board={task.connectionId}
                    taskKey={task.key}
                    assignee={task.assignee}
                    app={app}
                  />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={task.assignee?.name} />
                    <span className="truncate">{task.assignee?.name}</span>
                  </span>
                )}
              </Field>
              {/* Only the fields this task has; a grid of dashes says nothing. */}
              {task.priority && (
                <Field label={t("priority")}>
                  <Priority level={task.priorityLevel} label={task.priority} />
                </Field>
              )}
              {(task.estimateSeconds || task.loggedSeconds || provider?.logWork) && (
                <Field label={t("time")}>
                  {provider?.logWork ? (
                    <LogWork board={task.connectionId} taskKey={task.key} app={app}>
                      <TimeMeter logged={task.loggedSeconds} estimate={task.estimateSeconds} />
                    </LogWork>
                  ) : (
                    <TimeMeter logged={task.loggedSeconds} estimate={task.estimateSeconds} />
                  )}
                </Field>
              )}
              {task.storyPoints != null && (
                <Field label={t("points")}>
                  <span className="num">{task.storyPoints}</span>
                </Field>
              )}
              <Field label={t("updated")}>
                <time dateTime={task.updatedAt}>{formatAge(task.updatedAt, locale)}</time>
              </Field>
              {task.sprint && <Field label={t("sprint")}>{task.sprint}</Field>}
            </dl>

            <Description task={task} rich={!!provider?.getDescriptionHtml} />
            <Images task={task} />
            <Related task={task} />
            {provider?.getChildren &&
              (/epic/i.test(task.type ?? "") || (task.childCount ?? 0) > 0) && (
                <Children task={task} />
              )}
            {provider?.getComments && (
              <Comments
                board={task.connectionId}
                taskKey={task.key}
                app={app}
                canAdd={!!provider.addComment}
                canDelete={!!provider.deleteComment}
              />
            )}
          </div>
        </ScrollArea>
      )}
    </article>
  );
}
