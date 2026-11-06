"use server";

import { getProvider, providers, signInProviders } from "@mytask/core";

import { BoardLimitError, getBoard, newBoardId, removeBoard, saveBoard } from "@/server/boards";
import { errorBody, type ErrorBody } from "@/server/errors";
import { providerFetch } from "@/server/provider-fetch";
import { clearPending, saveSignedIn, setPending, takePending } from "@/server/sign-in";

type Result = { ok: true } | ErrorBody;
const limit = (): ErrorBody => ({ error: { code: "limit" } });

// shortcut: no rate limit on connect and sign-in attempts; add per-client limiting at the host before launch.

/**
 * Connects a board from its form: only the provider's own fields, checked, then tried against the source before saving.
 * With `boardId` it edits that board instead: a secret left empty keeps the one it has, which never leaves the server.
 */
export async function connectWithToken(
  providerId: string,
  input: { name: string; values: Record<string, string>; boardId?: string },
): Promise<Result> {
  const provider = providers.find((p) => p.id === providerId);
  if (!provider) return { error: { code: "invalid_input" } };
  const existing = input.boardId ? await getBoard(String(input.boardId)) : undefined;
  if (input.boardId && existing?.connection.providerId !== providerId)
    return { error: { code: "invalid_input" } };
  // A kept secret only goes back to the site it was made for: change the site and the token must be typed again.
  const sameSite = provider.fields
    .filter((f) => f.type === "url")
    .every((f) => existing?.connection.values[f.key] === input.values[f.key]);
  const keep = (key: string) => (sameSite && existing?.connection.values[key]) || "";
  const values: Record<string, string> = {};
  for (const field of provider.fields) {
    if (field.session) continue;
    const typed = String(input.values[field.key] ?? "")
      .trim()
      .slice(0, 4000);
    const value = !typed && field.type === "secret" ? keep(field.key) : typed;
    if (!value && !field.optional) return { error: { code: "invalid_input" } };
    if (value && field.type === "url") {
      const url = URL.canParse(value)
        ? new URL(value)
        : URL.canParse(`https://${value}`)
          ? new URL(`https://${value}`)
          : undefined;
      if (!url || url.protocol !== "https:") return { error: { code: "invalid_input" } };
      values[field.key] = url.origin + url.pathname.replace(/\/+$/, "");
    } else if (value) values[field.key] = value;
  }
  const connection = {
    id: existing?.connection.id ?? newBoardId(),
    providerId,
    name:
      String(input.name ?? "")
        .trim()
        .slice(0, 80) ||
      existing?.connection.name ||
      provider.defaultName(values),
    values,
  };
  try {
    await provider.validate(connection, providerFetch);
    await saveBoard({ connection, createdAt: existing?.createdAt ?? Date.now() });
    return { ok: true };
  } catch (error) {
    return error instanceof BoardLimitError ? limit() : errorBody(error);
  }
}

/** Renames a board's tab; the id, and so everything that points at the board, stays. */
export async function renameBoard(id: string, name: string): Promise<Result> {
  const board = await getBoard(String(id));
  const next = String(name ?? "")
    .trim()
    .slice(0, 80);
  if (!board || !next) return { error: { code: "invalid_input" } };
  await saveBoard({ ...board, connection: { ...board.connection, name: next } });
  return { ok: true };
}

export async function removeBoardAction(id: string): Promise<void> {
  await removeBoard(id);
}

/** Starts a device-code sign-in (GitHub): the code to show and the page to type it on. */
export async function beginDeviceSignIn(
  providerId: string,
): Promise<{ url: string; code: string } | ErrorBody> {
  const provider = signInProviders.find((p) => p.id === providerId);
  if (provider?.signIn?.kind !== "device") return { error: { code: "invalid_input" } };
  try {
    const { url, code, pending } = await provider.signIn.begin(providerFetch);
    await setPending(providerId, pending);
    return { url, code };
  } catch (error) {
    return errorBody(error);
  }
}

/**
 * Asks whether the code has been entered. Each call waits up to 20 seconds, then says "still waiting" so the page asks
 * again; the source's own polling interval is respected inside `finish`.
 */
export async function pollDeviceSignIn(): Promise<
  { done: number } | { waiting: true } | ErrorBody
> {
  const started = await takePending();
  const provider = started && getProvider(started.providerId);
  if (!started || provider?.signIn?.kind !== "device") return { error: { code: "invalid_input" } };
  try {
    const boards = await provider.signIn.finish(
      providerFetch,
      started.pending,
      AbortSignal.timeout(20_000),
    );
    const done = await saveSignedIn(started.providerId, boards);
    await clearPending();
    return { done };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
      return { waiting: true };
    await clearPending();
    return error instanceof BoardLimitError ? limit() : errorBody(error);
  }
}
