import { getProvider, type Task } from "@mytask/core";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { withSecrets, type StoredConnection } from "@/features/connections/api/connections";
import { useDebounce } from "@/hooks/use-debounce";
import { isHaltError } from "@/lib/query";

/** Searches each board's source (not just my tasks) once the query settles. Project keys from my tasks let "2750" mean PROJ-2750. */
export function useRemoteSearch(boards: StoredConnection[], query: string, myTasks: Task[]) {
  const q = useDebounce(query.trim(), 300);
  const qc = useQueryClient();
  // Boards whose sign-in was refused are skipped: every keystroke would be another failed login.
  const searchable = boards.filter(
    (b) =>
      getProvider(b.providerId)?.searchTasks &&
      !isHaltError(qc.getQueryState(["tasks", b.id])?.error),
  );
  const results = useQueries({
    queries: searchable.map((board) => ({
      queryKey: ["search", board.id, q],
      queryFn: async () => {
        const projectKeys = myTasks
          .filter((t) => t.connectionId === board.id)
          .map((t) => t.key.split("-")[0]!);
        return getProvider(board.providerId)!.searchTasks!(await withSecrets(board), q, fetch, {
          projectKeys,
        });
      },
      enabled: q.length >= 2,
      staleTime: 30_000,
    })),
  });
  return {
    active: q.length >= 2 && searchable.length > 0,
    /** Typed but not searched yet, or a request in flight. */
    pending: query.trim() !== q || results.some((r) => r.isFetching),
    tasks: results.flatMap((r) => r.data ?? []),
    failed: results.find((r) => r.isError)?.error,
  };
}
