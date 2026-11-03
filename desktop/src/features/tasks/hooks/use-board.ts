import { getProvider } from '@mytask/core';
import { useConnections } from '@/features/connections/hooks/use-connections';

/** The connection and provider behind a board, for actions that write back to the source. */
export function useBoard(connectionId: string) {
  const { data } = useConnections();
  const connection = data?.find((c) => c.id === connectionId);
  const provider = connection ? getProvider(connection.providerId) : undefined;
  return { connection, provider };
}
