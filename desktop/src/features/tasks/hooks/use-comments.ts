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

/** Adds `reply` under the comment with `parentId`, anywhere in the thread tree. */
function insertReply(list: Comment[], parentId: string, reply: Comment): Comment[] {
  return list.map((c) =>
    c.id === parentId
      ? { ...c, replies: [...(c.replies ?? []), reply] }
      : c.replies
        ? { ...c, replies: insertReply(c.replies, parentId, reply) }
        : c,
  );
}

/** Removes the comment with `id`, whether top-level or a nested reply. */
function removeComment(list: Comment[], id: string): Comment[] {
  return list.filter((c) => c.id !== id).map((c) => (c.replies ? { ...c, replies: removeComment(c.replies, id) } : c));
}

/** Posts a comment; the list shows it as soon as the source confirms, without a reload. `parentId` replies under a comment. */
export function useAddComment(connectionId: string, taskKey: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  return useMutation({
    mutationFn: async ({ text, parentId }: { text: string; parentId?: string }) => {
      if (!connection || !provider?.addComment) throw new Error('Comments are not supported here');
      return provider.addComment(await withSecrets(connection), taskKey, text, http, parentId);
    },
    onSuccess: (comment, { parentId }) =>
      qc.setQueryData<Comment[]>(['comments', connectionId, taskKey], (list) =>
        parentId ? insertReply(list ?? [], parentId, comment) : [...(list ?? []), comment],
      ),
  });
}

/** Deletes one of your comments; it leaves the list only once the source confirms. */
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
        qc.setQueryData<Comment[]>(['comments', connectionId, taskKey], (list) => (list ? removeComment(list, commentId) : list)),
    }),
  };
}
