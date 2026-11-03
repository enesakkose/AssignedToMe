import type { Attachment, Comment } from '@mytask/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { withSecrets } from '@/features/connections/api/connections';
import { http } from '@/lib/http';
import { useBoard } from './use-board';

export function useCanComment(connectionId: string) {
  const { provider } = useBoard(connectionId);
  return !!provider?.getComments;
}

/** Comments on one task, loaded when its details open. */
export function useComments(connectionId: string, taskKey: string, attachments: Attachment[] | undefined, enabled: boolean) {
  const { connection, provider } = useBoard(connectionId);
  return useQuery({
    queryKey: ['comments', connectionId, taskKey],
    queryFn: async () => provider!.getComments!(await withSecrets(connection!), taskKey, http, attachments),
    enabled: enabled && !!connection && !!provider?.getComments,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

/** Posts a comment; the list shows it as soon as Jira confirms, without a reload. */
export function useAddComment(connectionId: string, taskKey: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  return useMutation({
    mutationFn: async (text: string) => {
      if (!connection || !provider?.addComment) throw new Error('Comments are not supported here');
      return provider.addComment(await withSecrets(connection), taskKey, text, http);
    },
    onSuccess: (comment) => qc.setQueryData<Comment[]>(['comments', connectionId, taskKey], (list) => [...(list ?? []), comment]),
  });
}

/** Deletes one of your comments; it leaves the list only once Jira confirms. */
export function useDeleteComment(connectionId: string, taskKey: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  return {
    supported: !!provider?.deleteComment,
    mutation: useMutation({
      mutationFn: async (commentId: string) => {
        if (!connection || !provider?.deleteComment) throw new Error('Deleting comments is not supported here');
        await provider.deleteComment(await withSecrets(connection), taskKey, commentId, http);
      },
      onSuccess: (_d, commentId) =>
        qc.setQueryData<Comment[]>(['comments', connectionId, taskKey], (list) => list?.filter((c) => c.id !== commentId)),
    }),
  };
}
