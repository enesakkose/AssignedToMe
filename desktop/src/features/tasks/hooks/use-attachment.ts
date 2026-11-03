import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withSecrets } from '@/features/connections/api/connections';
import { http } from '@/lib/http';
import { useBoard } from './use-board';

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** An attachment as a data: URL (allowed by the CSP), downloaded once with the connection's credentials. */
export function useAttachmentImage(connectionId: string, url: string | undefined) {
  const { connection, provider } = useBoard(connectionId);
  return useQuery({
    queryKey: ['attachment', connectionId, url],
    queryFn: async () => toDataUrl(await provider!.downloadAttachment!(await withSecrets(connection!), url!, http)),
    enabled: !!url && !!connection && !!provider?.downloadAttachment,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
}

/** The same download as `useAttachmentImage`, on demand (for images inside source-rendered HTML); shares its cache. */
export function useLoadAttachment(connectionId: string) {
  const qc = useQueryClient();
  const { connection, provider } = useBoard(connectionId);
  if (!connection || !provider?.downloadAttachment) return undefined;
  return (url: string) =>
    qc.fetchQuery({
      queryKey: ['attachment', connectionId, url],
      queryFn: async () => toDataUrl(await provider.downloadAttachment!(await withSecrets(connection), url, http)),
      staleTime: Infinity,
      gcTime: 10 * 60_000,
    });
}

export function useCanShowAttachments(connectionId: string) {
  return !!useBoard(connectionId).provider?.downloadAttachment;
}
