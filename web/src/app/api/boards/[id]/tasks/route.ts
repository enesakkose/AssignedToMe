import { getProvider, renewConnection } from "@mytask/core";

import { getBoard, saveBoard } from "@/server/boards";
import { errorBody } from "@/server/errors";
import { providerFetch } from "@/server/provider-fetch";

const noStore = { "Cache-Control": "private, no-store" };

/**
 * One board's open tasks. Renews the sign-in when it is about to end and stores the new one, then asks the provider
 * through the guarded fetch. The browser gets tasks or an error code, never the board's credentials.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await getBoard(id);
  if (!board)
    return Response.json({ error: { code: "not_found" } }, { status: 404, headers: noStore });
  const provider = getProvider(board.connection.providerId)!;
  try {
    const { values, changed } = await renewConnection(
      provider,
      board.connection,
      providerFetch,
      async () => (await getBoard(id))?.connection ?? board.connection,
    );
    const connection = { ...board.connection, values };
    if (changed) await saveBoard({ ...board, connection });
    const tasks = await provider.fetchMyTasks(connection, providerFetch);
    return Response.json({ tasks }, { headers: noStore });
  } catch (error) {
    return Response.json(errorBody(error), { status: 502, headers: noStore });
  }
}
