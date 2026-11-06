"use client";

import { isSafeUrl, type Task } from "@mytask/core";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/ui/status";
import { cn } from "@/lib/cn";

import { getChildren } from "../actions";
import { unwrap } from "./actions/unwrap";

/** An epic's issues, or sub-issues the task only counts, loaded when the task is opened. Each opens in its source. */
export function Children({ task }: { task: Task }) {
  const t = useTranslations("detail");
  const children = useQuery({
    queryKey: ["children", task.connectionId, task.key],
    queryFn: () => unwrap(getChildren(task.connectionId, task.key, task.type)),
    staleTime: 60_000,
  });
  if (children.isError || children.data?.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-title">{t("children")}</h3>
      {children.isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <ul className="cut overflow-hidden border border-rule bg-paper">
          {children.data.map((c) => (
            <li key={c.id} className="border-b border-rule last:border-b-0">
              <a
                href={isSafeUrl(c.url) ? c.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-paper-2"
              >
                <StatusDot category={c.statusCategory} status={c.status} />
                <span className="shrink-0 font-mono text-xs text-muted">{c.key}</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-md",
                    c.statusCategory === "done" && "text-muted line-through",
                  )}
                >
                  {c.title}
                </span>
                <Avatar name={c.assignee?.name} />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
