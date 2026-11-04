import type { Task, WorkLog, WorkLogEntry } from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withSecrets } from "@/features/connections/api/connections";
import { useBoard } from "./use-board";

export function useCanLogWork(connectionId: string) {
  const { provider } = useBoard(connectionId);
  return !!provider?.logWork;
}

/** Adds `delta` seconds to a task or sub-task in the cached list, so the card updates before the refetch. */
function addLogged(tasks: Task[] | undefined, taskKey: string, delta: number) {
  const bump = <T extends { key: string; loggedSeconds?: number }>(t: T): T =>
    t.key === taskKey ? { ...t, loggedSeconds: Math.max(0, (t.loggedSeconds ?? 0) + delta) } : t;
  return tasks?.map((t) => ({ ...bump(t), subtasks: t.subtasks?.map(bump) }));
}

/** Logs on one task, loaded when the log panel opens. */
export function useWorkLogs(connectionId: string, taskKey: string, enabled: boolean) {
  const { connection, provider } = useBoard(connectionId);
  return useQuery({
    queryKey: ["worklogs", connectionId, taskKey],
    queryFn: async () => provider!.getWorkLogs!(await withSecrets(connection!), taskKey, fetch),
    enabled: enabled && !!connection && !!provider?.getWorkLogs,
    staleTime: 0,
    gcTime: 60_000,
  });
}

type Log = { taskKey: string; entry: WorkLogEntry };
type Unlog = { taskKey: string; workLogId: string; seconds: number };

export function useLogWork(connectionId: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  const tasksKey = ["tasks", connectionId];

  const optimistic = async (taskKey: string, delta: number) => {
    await qc.cancelQueries({ queryKey: tasksKey });
    const previous = qc.getQueryData<Task[]>(tasksKey);
    qc.setQueryData<Task[]>(tasksKey, (tasks) => addLogged(tasks, taskKey, delta));
    return { previous };
  };
  const rollback = (_e: unknown, _v: unknown, context?: { previous?: Task[] }) => {
    if (context?.previous) qc.setQueryData(tasksKey, context.previous);
  };
  const refresh = (_d: unknown, _e: unknown, { taskKey }: { taskKey: string }) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: tasksKey }),
      qc.invalidateQueries({ queryKey: ["search", connectionId] }),
      qc.invalidateQueries({ queryKey: ["task", connectionId] }),
      qc.invalidateQueries({ queryKey: ["worklogs", connectionId, taskKey] }),
    ]);

  const log = useMutation({
    mutationFn: async ({ taskKey, entry }: Log) => {
      if (!connection || !provider?.logWork) throw new Error("Time tracking is not supported here");
      return provider.logWork(await withSecrets(connection), taskKey, entry, fetch);
    },
    onMutate: ({ taskKey, entry }: Log) => optimistic(taskKey, entry.seconds),
    onError: rollback,
    onSettled: refresh,
  });

  const unlog = useMutation({
    mutationFn: async ({ taskKey, workLogId }: Unlog) => {
      if (!connection || !provider?.deleteWorkLog)
        throw new Error("Time tracking is not supported here");
      await provider.deleteWorkLog(await withSecrets(connection), taskKey, workLogId, fetch);
    },
    // Not optimistic: the log stays until the source confirms, then leaves the list and the total.
    onSuccess: (_data, { taskKey, workLogId, seconds }: Unlog) => {
      qc.setQueryData<WorkLog[]>(["worklogs", connectionId, taskKey], (logs) =>
        logs?.filter((l) => l.id !== workLogId),
      );
      qc.setQueryData<Task[]>(tasksKey, (tasks) => addLogged(tasks, taskKey, -seconds));
    },
    onSettled: refresh,
  });

  return { log, unlog };
}
