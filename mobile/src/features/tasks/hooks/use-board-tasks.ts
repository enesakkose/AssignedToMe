import { useQueries } from "@tanstack/react-query";
import { type StoredConnection } from "@/features/connections/api/connections";
import { isHaltError } from "@/lib/query";
import { usePersistStore } from "@/stores/persist-store";
import { fetchTasks } from "../api/fetch-tasks";
import { getCachedTasks } from "../api/task-cache";

/** One query per board. Refreshes on the chosen interval while the app is open, and on return when older than it. */
export function useBoardTasks(connections: StoredConnection[]) {
  const refreshMs = usePersistStore((s) => s.refreshMinutes) * 60_000;
  return useQueries({
    queries: connections.map((c) => ({
      // Last session's tasks show at once; a refetch replaces them when they're older than the refresh interval.
      initialData: () => getCachedTasks(c.id)?.tasks,
      initialDataUpdatedAt: () => getCachedTasks(c.id)?.updatedAt,
      queryKey: ["tasks", c.id],
      queryFn: () => fetchTasks(c),
      staleTime: refreshMs,
      // After a refused sign-in a board waits for the user (edit the connection) instead of trying again on its own.
      refetchInterval: (query: { state: { error: unknown } }) =>
        isHaltError(query.state.error) ? false : refreshMs,
      refetchOnWindowFocus: (query: { state: { error: unknown } }) =>
        !isHaltError(query.state.error),
    })),
  });
}
