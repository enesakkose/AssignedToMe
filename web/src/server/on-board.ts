import "server-only";

import { getProvider, renewConnection, type Connection, type Provider } from "@mytask/core";

import { getBoard, saveBoard } from "./boards";
import { errorBody, type ErrorBody } from "./errors";
import { providerFetch } from "./provider-fetch";

export type Result<T> = { ok: T } | ErrorBody;

/**
 * The one way a board is used on the server: open its sealed cookie, renew the sign-in when it is about to end (and
 * keep the new one), then run against the provider with the guarded fetch. Errors come back as codes, never messages.
 */
export async function onBoard<T>(
  boardId: string,
  run: (provider: Provider, connection: Connection) => Promise<T>,
): Promise<Result<T>> {
  const board = await getBoard(boardId);
  if (!board) return { error: { code: "not_found" } };
  const provider = getProvider(board.connection.providerId)!;
  try {
    const { values, changed } = await renewConnection(
      provider,
      board.connection,
      providerFetch,
      async () => (await getBoard(boardId))?.connection ?? board.connection,
    );
    const connection = { ...board.connection, values };
    if (changed) await saveBoard({ ...board, connection });
    return { ok: await run(provider, connection) };
  } catch (error) {
    // Server-side only: the provider's error detail (never credentials) so a failing action is debuggable.
    console.error(`board ${boardId} action failed:`, error instanceof Error ? error.message : error);
    return errorBody(error);
  }
}

/** A provider without the capability: the UI hides the action, so a call here is a stale or crafted request. */
export function unsupported(): never {
  throw new Error("unsupported");
}
