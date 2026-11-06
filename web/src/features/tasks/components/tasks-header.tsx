"use client";

import { PanelLeftOpen } from "lucide-react";
import { activeFilterCount, emptyFilters, type Provider, type TaskFilters } from "@mytask/core";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { MobileNav } from "@/components/layout/mobile-nav";
import { IconButton } from "@/components/ui/button";
import { BoardMenu } from "@/features/boards/components/board-menu";
import { ProviderLogo } from "@/components/ui/provider-logo";

import type { Queue } from "../lib/build-queue";
import { queueHref, toggleFilter, type QueueParams } from "../lib/queue-params";
import { FilterMenu, type FilterGroupView } from "./filter-menu";
import { SearchField } from "./search-field";

type GroupId = keyof Pick<TaskFilters, "status" | "priority" | "type">;

/** The page's title row: what is being looked at and how many, then search and filters. */
export function TasksHeader({
  queue,
  params,
  provider,
  nav,
  onExpandSidebar,
}: {
  queue: Queue;
  params: QueueParams;
  provider?: Provider;
  nav: ReactNode;
  /** Set while the sidebar is collapsed: draws the button that brings it back (from 1024px). */
  onExpandSidebar?: () => void;
}) {
  const t = useTranslations("queue");
  const tn = useTranslations("nav");
  const defs: { id: GroupId; label: string; options: { value: string; label: string }[] }[] = [
    {
      id: "status",
      label: t("status"),
      options: [
        { value: "todo", label: t("statusTodo") },
        { value: "in_progress", label: t("statusInProgress") },
      ],
    },
    {
      id: "priority",
      label: t("priority"),
      options: [
        { value: "high", label: t("priorityHigh") },
        { value: "medium", label: t("priorityMedium") },
        { value: "low", label: t("priorityLow") },
      ],
    },
    {
      id: "type",
      label: t("type"),
      options: queue.types.map((value) => ({ value, label: value })),
    },
  ];
  const groups: FilterGroupView[] = defs
    .filter((g) => g.options.length > 0)
    .map((g) => ({
      id: g.id,
      label: g.label,
      options: g.options.map((o) => ({
        label: o.label,
        href: queueHref(toggleFilter(params, g.id, o.value)),
        active: (params.filters[g.id] as string[]).includes(o.value),
      })),
    }));
  return (
    <header className="sticky top-0 z-20 flex bg-[var(--color-bar)] backdrop-blur-md min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-2.5 sm:px-6">
      <MobileNav label={tn("open")}>{nav}</MobileNav>
      {onExpandSidebar && (
        <IconButton
          label={tn("expand")}
          onClick={onExpandSidebar}
          className="-ml-1.5 hidden lg:inline-flex"
        >
          <PanelLeftOpen />
        </IconButton>
      )}
      <div className="flex min-w-0 items-center gap-2.5">
        {provider && <ProviderLogo provider={provider} />}
        <h1 className="truncate text-lg">{queue.board?.name ?? t("title")}</h1>
        <span className="num text-md text-muted">{queue.tasks.length}</span>
        {queue.board && (
          <BoardMenu
            id={queue.board.id}
            name={queue.board.name}
            app={provider?.appName ?? queue.board.name}
            providerId={queue.board.providerId}
          />
        )}
      </div>
      {/* Nothing to search or filter until a board is connected. */}
      {queue.connected > 0 && (
        <>
          <div className="order-last basis-full sm:order-none sm:ml-auto sm:basis-auto">
            <SearchField label={t("search")} clearLabel={t("searchClear")} initial={params.q} />
          </div>
          <div className="ml-auto sm:ml-0">
            <FilterMenu
              label={t("filter")}
              clearLabel={t("filterClear")}
              count={activeFilterCount(params.filters)}
              groups={groups}
              clearHref={queueHref(params, { filters: emptyFilters() })}
            />
          </div>
        </>
      )}
    </header>
  );
}
