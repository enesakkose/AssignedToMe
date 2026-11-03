import { getProvider, ProviderError, type Task } from '@mytask/core';
import { useQueries } from '@tanstack/react-query';
import { withSecrets, type StoredConnection } from '@/features/connections/api/connections';
import { http } from '@/lib/http';
import { HOUR, isHaltError } from '@/lib/query';
import { broadcast, isAppWindow } from '@/lib/windows';
import { useNav } from '@/stores/nav';
import { cacheTasks, getCachedTasks } from '../api/task-cache';

async function fetchTasks(connection: StoredConnection): Promise<Task[]> {
  const provider = getProvider(connection.providerId);
  if (!provider) throw new ProviderError('invalid_input', `Unknown provider ${connection.providerId}`);
  const tasks = await provider.fetchMyTasks(await withSecrets(connection), http);
  await cacheTasks(connection.id, tasks);
  // The other window takes this result instead of hitting the API again.
  broadcast('tasks-fetched', { connectionId: connection.id, tasks });
  return tasks;
}

/**
 * A board's task query. Everything that reads ['tasks', id] must use these same options: TanStack Query keeps
 * the last observer's options on the query, so a watcher without the fetch function would break refetching.
 */
export function boardTasksOptions(connection: StoredConnection, refreshMs: number = HOUR) {
  const cached = getCachedTasks(connection.id);
  return {
    queryKey: ['tasks', connection.id],
    queryFn: () => fetchTasks(connection),
    initialData: cached?.tasks,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: refreshMs,
    // After a refused sign-in this board waits for the user (edit or Retry) instead of trying again on its own.
    // Only the popover (always running, hidden) polls; the app window gets those results broadcast to it.
    refetchInterval: (query: { state: { error: unknown } }) => (isAppWindow || isHaltError(query.state.error) ? false : refreshMs),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: (query: { state: { error: unknown } }) => !isHaltError(query.state.error),
    refetchOnReconnect: (query: { state: { error: unknown } }) => !isHaltError(query.state.error),
  };
}

/** One query per board. Refreshes on the chosen interval (default hourly), and on focus when the data is older than it. */
export function useBoardTasks(connections: StoredConnection[]) {
  const refreshMs = useNav((s) => s.refreshMs);
  return useQueries({ queries: connections.map((c) => boardTasksOptions(c, refreshMs)) });
}
