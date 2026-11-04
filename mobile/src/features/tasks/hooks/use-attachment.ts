import { useQuery } from "@tanstack/react-query";
import { withSecrets } from "@/features/connections/api/connections";
import { useBoard } from "./use-board";

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** An attachment as a data: URL, downloaded once with the connection's credentials. */
export function useAttachmentImage(connectionId: string, url: string | undefined) {
  const { connection, provider } = useBoard(connectionId);
  return useQuery({
    queryKey: ["attachment", connectionId, url],
    queryFn: async () =>
      toDataUrl(await provider!.downloadAttachment!(await withSecrets(connection!), url!, fetch)),
    enabled: !!url && !!connection && !!provider?.downloadAttachment,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
}

export function useCanShowAttachments(connectionId: string) {
  return !!useBoard(connectionId).provider?.downloadAttachment;
}
