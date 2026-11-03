import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { forgetTasks } from '@/features/tasks/api/task-cache';
import { listConnections, removeConnection, renameConnection, saveConnection } from '../api/connections';

export const connectionsKey = ['connections'];

export function useConnections() {
  return useQuery({ queryKey: connectionsKey, queryFn: listConnections, staleTime: Infinity });
}

export function useSaveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveConnection,
    onSuccess: async (_data, connection) => {
      await qc.invalidateQueries({ queryKey: connectionsKey });
      await qc.invalidateQueries({ queryKey: ['tasks', connection.id] });
    },
  });
}

export function useRenameConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameConnection(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: connectionsKey }),
  });
}

export function useRemoveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await removeConnection(id);
      await forgetTasks(id);
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: ['tasks', id] });
      return qc.invalidateQueries({ queryKey: connectionsKey });
    },
  });
}
