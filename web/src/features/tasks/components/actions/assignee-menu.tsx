"use client";

import type { Person } from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, UserMinus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverHeader, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toaster";
import { useErrorText } from "@/features/connections/error-text";

import { assignTask, currentUser, searchAssignees } from "../../actions";
import { detailOf, unwrap } from "./unwrap";

const row =
  "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-left text-md text-ink transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 disabled:opacity-50";

/** The assignee opens this: search people, assign to me, or unassign. Reassigning one of my tasks says it leaves my list. */
export function AssigneeMenu({
  board,
  taskKey,
  assignee,
  app,
}: {
  board: string;
  taskKey: string;
  assignee?: Person;
  app: string;
}) {
  const t = useTranslations("actions");
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(id);
  }, [query]);

  const me = useQuery({
    queryKey: ["me", board],
    queryFn: () => unwrap(currentUser(board)),
    enabled: open,
    staleTime: 60 * 60_000,
  });
  const people = useQuery({
    queryKey: ["people", board, taskKey, debounced],
    queryFn: () => unwrap(searchAssignees(board, taskKey, debounced)),
    enabled: open,
  });
  const assign = useMutation({
    mutationFn: (person: Person | null) => unwrap(assignTask(board, taskKey, person?.id ?? null)),
    onSuccess: (_, person) => {
      setOpen(false);
      const leaves = !!me.data && person?.id !== me.data.id;
      toast.success(
        person
          ? t("assigned", { key: taskKey, name: person.name })
          : t("unassignedDone", { key: taskKey }),
        leaves ? { description: t("leavesList") } : undefined,
      );
    },
    onError: (e) => toast.error(t("assignFailed"), { description: errorText(detailOf(e), app) }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["tasks", board] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("changeAssignee", { key: taskKey })}
        className="-mx-2 inline-flex min-w-0 items-center gap-2 rounded-full px-2 py-0.5 transition-colors duration-[var(--dur-micro)] hover:bg-paper-3 data-[popup-open]:bg-paper-3"
      >
        <Avatar name={assignee?.name} />
        <span className="truncate">{assignee?.name ?? t("unassigned")}</span>
        {assign.isPending ? (
          <Spinner className="text-muted" />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
        )}
      </PopoverTrigger>
      <PopoverContent className="flex max-h-[var(--available-height)] w-80 flex-col gap-2">
        <PopoverHeader title={t("assignee")} closeLabel={t("close")} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPeople")}
          aria-label={t("searchPeople")}
          autoFocus
        />
        <div className="flex flex-col">
          {me.data && me.data.id !== assignee?.id && (
            <button
              type="button"
              className={row}
              disabled={assign.isPending}
              onClick={() => assign.mutate(me.data!)}
            >
              <UserRound className="size-4 text-muted" aria-hidden />
              {t("assignToMe")}
            </button>
          )}
          {assignee && (
            <button
              type="button"
              className={row}
              disabled={assign.isPending}
              onClick={() => assign.mutate(null)}
            >
              <UserMinus className="size-4 text-muted" aria-hidden />
              {t("unassign")}
            </button>
          )}
        </div>
        <div className="-mx-3 min-h-0 flex-1 overflow-y-auto border-t border-rule px-3 pt-2">
          {people.isPending ? (
            <div className="flex h-9 items-center gap-2 px-2 text-md text-muted">
              <Spinner />
            </div>
          ) : people.isError ? (
            <p className="px-2 text-sm text-error">{errorText(detailOf(people.error), app)}</p>
          ) : people.data.people.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted">{t("noPeople")}</p>
          ) : (
            <ul className="flex flex-col">
              {people.data.people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={row}
                    disabled={assign.isPending || p.id === assignee?.id}
                    onClick={() => assign.mutate(p)}
                  >
                    <Avatar name={p.name} />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
