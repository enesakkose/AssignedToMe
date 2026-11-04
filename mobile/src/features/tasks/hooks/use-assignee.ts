import type { Person, Task } from "@mytask/core";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withSecrets } from "@/features/connections/api/connections";
import { useBoard } from "./use-board";

export function useCanAssign(connectionId: string) {
  const { provider } = useBoard(connectionId);
  return !!(provider?.assign && provider.searchAssignees);
}

/** The connected account, for "assign to me". */
export function useCurrentUser(connectionId: string, enabled = true) {
  const { connection, provider } = useBoard(connectionId);
  return useQuery({
    queryKey: ["me", connectionId],
    queryFn: async () => provider!.currentUser!(await withSecrets(connection!), fetch),
    enabled: enabled && !!connection && !!provider?.currentUser,
    staleTime: Infinity,
  });
}

/** Pages through people as the list is scrolled; `data.pages` holds each page. */
export function useAssignees(
  connectionId: string,
  taskKey: string,
  query: string,
  enabled: boolean,
) {
  const { connection, provider } = useBoard(connectionId);
  return useInfiniteQuery({
    queryKey: ["assignees", connectionId, taskKey, query],
    queryFn: async ({ pageParam }) =>
      provider!.searchAssignees!(await withSecrets(connection!), taskKey, query, fetch, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.next,
    enabled: enabled && !!connection && !!provider?.searchAssignees,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

type Assign = { taskKey: string; person: Person | null };

/** Reassigns a task or sub-task; the card shows the new assignee at once and rolls back on failure. */
export function useAssign(connectionId: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  const tasksKey = ["tasks", connectionId];

  return useMutation({
    mutationFn: async ({ taskKey, person }: Assign) => {
      if (!connection || !provider?.assign) throw new Error("Assignment is not supported here");
      await provider.assign(await withSecrets(connection), taskKey, person?.id ?? null, fetch);
    },
    onMutate: async ({ taskKey, person }: Assign) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      const assignee = person ?? undefined;
      qc.setQueryData<Task[]>(tasksKey, (tasks) =>
        tasks?.map((t) =>
          t.key === taskKey
            ? { ...t, assignee }
            : {
                ...t,
                subtasks: t.subtasks?.map((s) => (s.key === taskKey ? { ...s, assignee } : s)),
              },
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(tasksKey, context.previous);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: tasksKey }),
        qc.invalidateQueries({ queryKey: ["search", connectionId] }),
        qc.invalidateQueries({ queryKey: ["task", connectionId] }),
      ]),
  });
}
