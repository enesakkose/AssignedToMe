"use client";

import { getProvider, type Provider, type Task } from "@mytask/core";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { BoardNav } from "@/features/boards/components/board-nav";
import type { Board } from "@/features/boards/lib/board";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";

import { buildQueue } from "../lib/build-queue";
import { useSourceSearch } from "../lib/use-source-search";
import type { QueueParams } from "../lib/queue-params";
import { TaskDetail } from "./task-detail";
import { TaskList } from "./task-list";
import { TasksHeader } from "./tasks-header";

export type BoardView = Pick<Board, "id" | "name" | "providerId">;
type BoardResult = { tasks: Task[] } | { error: { code: string; status?: number } };

class LoadError extends Error {
  constructor(readonly detail: { code: string; status?: number }) {
    super(detail.code);
  }
}

/** One board's tasks from the server, which holds its sign-in. A failed board carries the server's error code. */
async function loadBoard(id: string): Promise<Task[]> {
  const res = await fetch(`/api/boards/${id}/tasks`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({ error: { code: "unknown" } }))) as BoardResult;
  if ("error" in body) throw new LoadError(body.error);
  return body.tasks;
}

/** The task screen: each board's tasks loaded on their own, then searched, filtered and shown as one list. */
export function TasksScreen({
  boards: stored,
  params,
}: {
  boards: BoardView[];
  params: QueueParams;
}) {
  const results = useQueries({
    queries: stored.map((b) => ({ queryKey: ["tasks", b.id], queryFn: () => loadBoard(b.id) })),
  });
  const loading = results.some((r) => r.isPending);
  const boards: Board[] = stored.map((b, i) => {
    const error = results[i]?.error;
    return error
      ? {
          ...b,
          signedOut: true,
          error: error instanceof LoadError ? error.detail : { code: "network" },
        }
      : b;
  });
  const tasks = results.flatMap((r) => r.data ?? []);
  const queue = buildQueue(params, boards, tasks);
  const providers = useMemo(
    () =>
      new Map<string, Provider>(
        stored.flatMap((b) => {
          const provider = getProvider(b.providerId);
          return provider ? [[b.id, provider] as const] : [];
        }),
      ),
    [stored],
  );
  const remote = useSourceSearch(queue.board ? [queue.board] : boards, providers, params.q, tasks);
  // The sidebar's open or collapsed state is this viewer's own preference, remembered in this browser.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("atm.sidebar") === "collapsed");
    } catch {}
  }, []);
  const toggle = (next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem("atm.sidebar", next ? "collapsed" : "open");
    } catch {}
  };
  const boardNav = (
    <BoardNav boards={boards} providers={providers} counts={queue.counts} params={params} />
  );
  const nav = <Sidebar nav={boardNav} />;
  const selected = queue.selected ?? remote.tasks.find((t) => t.key === params.task);
  return (
    <AppShell
      sidebar={<Sidebar nav={boardNav} onCollapse={() => toggle(true)} />}
      collapsed={collapsed}
    >
      {/* On a phone the open task takes the screen; from 1024px it is a panel and the list narrows beside it. */}
      <ScrollArea
        render={<main />}
        className={cn("min-w-0 flex-1", selected ? "hidden lg:block" : "block")}
      >
        <TasksHeader
          queue={queue}
          params={params}
          provider={queue.board && providers.get(queue.board.id)}
          nav={nav}
          onExpandSidebar={collapsed ? () => toggle(false) : undefined}
        />
        <TaskList
          queue={queue}
          params={params}
          providers={providers}
          loading={loading}
          remote={remote}
        />
      </ScrollArea>
      {selected && (
        <aside className="flex min-w-0 flex-1 flex-col border-rule lg:w-[26rem] lg:flex-none lg:border-l xl:w-[32rem]">
          <TaskDetail
            key={selected.key}
            task={selected}
            provider={providers.get(selected.connectionId)}
            params={params}
          />
        </aside>
      )}
    </AppShell>
  );
}
