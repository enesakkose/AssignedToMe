"use client";

import type { Provider, Task } from "@mytask/core";
import { useQueries } from "@tanstack/react-query";

import type { Board } from "@/features/boards/lib/board";

import { searchSource } from "../actions";
import { unwrap } from "../components/actions/unwrap";

export type SourceSearch = { tasks: Task[]; pending: boolean };

/**
 * Searches each board's source (not just my tasks) for what was typed, skipping boards whose sign-in failed: every
 * keystroke would be another refused login. Tasks already in my list are left out. The URL is already debounced.
 */
export function useSourceSearch(
  boards: Board[],
  providers: Map<string, Provider>,
  query: string,
  mine: Task[],
): SourceSearch {
  const q = query.trim();
  const searchable = boards.filter((b) => !b.signedOut && providers.get(b.id)?.searchTasks);
  const results = useQueries({
    queries: searchable.map((board) => ({
      queryKey: ["search", board.id, q],
      queryFn: () => {
        const keys = [
          ...new Set(
            mine.filter((t) => t.connectionId === board.id).map((t) => t.key.split("-")[0]!),
          ),
        ].filter((k) => /^[A-Za-z0-9_]{1,40}$/.test(k));
        return unwrap(searchSource(board.id, q, keys.slice(0, 50)));
      },
      enabled: q.length >= 2,
      staleTime: 30_000,
    })),
  });
  const known = new Set(mine.map((t) => `${t.connectionId}:${t.key}`));
  return {
    tasks: results
      .flatMap((r) => r.data ?? [])
      .filter((t) => !known.has(`${t.connectionId}:${t.key}`)),
    pending: results.some((r) => r.isFetching),
  };
}
