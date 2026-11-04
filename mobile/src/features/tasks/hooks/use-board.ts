import { getProvider } from "@mytask/core";
import { useConnectionsStore } from "@/features/connections/api/connections";

/** The connection and provider behind a board, for actions that write back to the source. */
export function useBoard(connectionId: string) {
  const connection = useConnectionsStore((s) => s.connections.find((c) => c.id === connectionId));
  const provider = connection ? getProvider(connection.providerId) : undefined;
  return { connection, provider };
}
