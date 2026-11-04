import type { Task, Transition, TransitionInput } from "@mytask/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withSecrets } from "@/features/connections/api/connections";
import { useBoard } from "./use-board";

function useTransitionBoard(connectionId: string) {
  const board = useBoard(connectionId);
  return { ...board, supported: !!(board.provider?.getTransitions && board.provider.transition) };
}

/** Statuses this task can move to, fetched when the menu opens (they depend on workflow and permissions). */
export function useTransitions(connectionId: string, taskKey: string, enabled: boolean) {
  const { connection, provider, supported } = useTransitionBoard(connectionId);
  return useQuery({
    queryKey: ["transitions", connectionId, taskKey],
    queryFn: async () => provider!.getTransitions!(await withSecrets(connection!), taskKey, fetch),
    enabled: enabled && supported,
    staleTime: 0,
    gcTime: 30_000,
  });
}

export function useCanChangeStatus(connectionId: string) {
  return useTransitionBoard(connectionId).supported;
}

type Change = { taskKey: string; transition: Transition; input?: TransitionInput };

/** Moves a task (or sub-task) and shows the new status at once; rolls back if the provider refuses. */
export function useChangeStatus(connectionId: string) {
  const qc = useQueryClient();
  const { connection, provider } = useTransitionBoard(connectionId);
  const tasksKey = ["tasks", connectionId];

  return useMutation({
    mutationFn: async ({ taskKey, transition, input }: Change) => {
      if (!connection || !provider?.transition)
        throw new Error("Status changes are not supported here");
      await provider.transition(await withSecrets(connection), taskKey, transition, fetch, input);
    },
    onMutate: async ({ taskKey, transition }: Change) => {
      await qc.cancelQueries({ queryKey: tasksKey });
      const previous = qc.getQueryData<Task[]>(tasksKey);
      const status = { status: transition.to.name, statusCategory: transition.to.category };
      // Moved to done (or cancelled): it leaves the list now, not on the next refresh (my list holds open work only).
      // A sub-task stays under its parent, shown as done.
      const leaves = transition.to.category === "done";
      qc.setQueryData<Task[]>(tasksKey, (tasks) =>
        tasks
          ?.filter((t) => !(leaves && t.key === taskKey))
          .map((t) =>
            t.key === taskKey
              ? { ...t, ...status }
              : {
                  ...t,
                  subtasks: t.subtasks?.map((s) => (s.key === taskKey ? { ...s, ...status } : s)),
                },
          ),
      );
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) qc.setQueryData(tasksKey, context.previous);
    },
    onSettled: (_data, _error, { taskKey }) => {
      void qc.invalidateQueries({ queryKey: tasksKey });
      void qc.invalidateQueries({ queryKey: ["search", connectionId] });
      void qc.invalidateQueries({ queryKey: ["task", connectionId] });
      void qc.invalidateQueries({ queryKey: ["transitions", connectionId, taskKey] });
    },
  });
}

/** Finds the transition back to a previous status, if the workflow allows it without extra fields. */
export function useFindTransitionBack(connectionId: string) {
  const { connection, provider } = useTransitionBoard(connectionId);
  return async (taskKey: string, statusName: string) => {
    if (!connection || !provider?.getTransitions) return undefined;
    const transitions = await provider.getTransitions(
      await withSecrets(connection),
      taskKey,
      fetch,
    );
    return transitions.find((t) => t.to.name === statusName && !t.needsInput);
  };
}
